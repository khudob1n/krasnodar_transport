#!/usr/bin/env bash
# Выпуск версии одной командой (запускается на компьютере разработчика):
#   ./release.sh 0.2.0     - поднять версию до 0.2.0 (versionCode +1), прогнать тесты, собрать
#   ./release.sh           - собрать текущую версию заново
# Результат - в release/<версия>/: подписанные APK (установить вручную, выложить в свой
# магазин) и AAB (Google Play, RuStore), плюс изменения этой версии из CHANGELOG.md.
# Ключ подписи - вне проекта (см. README, «Выпуск»); без него скрипт останавливается.
set -euo pipefail
cd "$(dirname "$0")"

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
KEYSTORE="${KEYSTORE_PROPERTIES:-$HOME/.android/keys/krasnodar-transport/keystore.properties}"
[ -f "$KEYSTORE" ] || { echo "Нет ключа подписи: $KEYSTORE" >&2; exit 1; }

get() { grep "^$1=" version.properties | cut -d= -f2; }
if [ $# -ge 1 ]; then
    code=$(( $(get versionCode) + 1 ))
    sed -i '' "s/^versionCode=.*/versionCode=$code/; s/^versionName=.*/versionName=$1/" version.properties
fi
name=$(get versionName)
code=$(get versionCode)

# Изменения версии - раздел «## <версия>» в CHANGELOG.md; без него выпуск не делаем.
notes=$(awk -v v="## $name" '$0==v{on=1;next} /^## /{on=0} on' CHANGELOG.md | sed '/./,$!d')
[ -n "$notes" ] || { echo "В CHANGELOG.md нет раздела «## $name»" >&2; exit 1; }

echo "→ Тесты"
./gradlew -q :app:testDebugUnitTest

echo "→ Сборка $name ($code)"
./gradlew -q :app:assembleRelease :app:bundleRelease -PkeystoreProperties="$KEYSTORE"

out="release/$name"
mkdir -p "$out"
cp app/build/outputs/apk/release/app-release.apk "$out/transport-krasnodar-$name.apk"
cp app/build/outputs/bundle/release/app-release.aab "$out/transport-krasnodar-$name.aab"
printf '%s\n' "$notes" > "$out/changes.txt"

# Подпись - нашим ключом, а не отладочным.
apksigner=$(ls -d "$HOME/Library/Android/sdk/build-tools/"* | sort -V | tail -1)/apksigner
"$apksigner" verify --print-certs "$out/transport-krasnodar-$name.apk" | grep -m1 "SHA-256"

echo "Готово: $out"
ls -la "$out"
