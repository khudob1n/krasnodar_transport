# Транспорт Краснодара — Android

Приложение повторяет пассажирский сайт (`../passenger/client`) — и внешний вид, и возможности —
на тех же данных. Kotlin, Jetpack Compose, MapLibre.

## Сборка

Нужны Android SDK (ставится с Android Studio) и JDK 17+ — подойдёт JDK из Android Studio:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. Путь к SDK — в `local.properties`
(`sdk.dir=...`, файл не в git).

Всё API приложение берёт с адреса сайта (`docs/app-api.md`). Debug-сборка по умолчанию ходит в
локальный сайт (`krd-passenger`, порт 3300) через проброс порта — после запуска эмулятора:

```bash
~/Library/Android/sdk/platform-tools/adb reverse tcp:3300 tcp:3300
```

`10.0.2.2` не подходит: на Android 17 приложению без отдельного разрешения закрыт доступ в
локальную сеть. Release ходит на прод. Другой адрес: `./gradlew :app:assembleDebug -PapiBaseUrl=https://...`.

## Что откуда

- Стили карты и глифы подписей берутся при сборке из `../passenger/client/public`
  (задача `syncWebAssets` в `app/build.gradle.kts`) — их собирает
  `passenger/tools/build-map-style.py`, править цвета карты нужно там.

## Тесты

Юнит-тесты (поиск маршрута, ближайшие отправления, поиск, избранное) - на настоящих данных
из `../data`:

```bash
./gradlew :app:testDebugUnitTest
```

Сценарии пассажира на эмуляторе (главная и карта, остановка и избранное, маршрут, настройки,
маршрут до адреса) - с данными прода:

```bash
./gradlew :app:connectedDebugAndroidTest -PapiBaseUrl=https://krasnodar-transport.khudob1n.ru
```

## Выпуск

```bash
./release.sh 0.2.0
```

Поднимает версию (`version.properties`: versionName и versionCode +1), прогоняет юнит-тесты,
собирает подписанные APK и AAB с адресом прода и кладёт их в `release/<версия>/` вместе с
изменениями этой версии. Перед выпуском в `CHANGELOG.md` должен быть раздел `## <версия>`.

Ключ подписи (upload key) - вне проекта: `~/.android/keys/krasnodar-transport/`
(`upload.jks` и `keystore.properties` с паролем, права 600). Другое место -
`KEYSTORE_PROPERTIES=/путь/keystore.properties ./release.sh`. **Ключ нужно сохранить в
надёжном месте** (менеджер паролей, резервная копия): без него обновление в магазине
выпустить нельзя, в Google Play его можно только сбросить через поддержку.
