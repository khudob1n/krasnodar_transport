import React from 'react';
import { Provider } from 'react-redux';

import { store } from 'state';
import { ThemeProvider } from 'components/ThemeProvider';
import { FavoritesProvider } from 'components/FavoritesProvider';
import { IconSizesProvider } from 'components/IconSizesProvider';
import { DevSettingsProvider } from 'components/DevSettingsProvider';
import { MapPreferencesProvider } from 'components/MapPreferencesProvider';
import { Splash } from 'components/Splash/Splash';
import { SeoMeta } from 'components/SeoMeta';

// Шрифт текста на карте (поиск, сайдбары остановки/ТС, номер маршрута на маркере) -
// см. .leaflet-container в styles/globals.css. Подписи улиц на самой карте (рисует MapLibre
// на canvas) тоже JetBrains Mono, но независимо от этого webfont-а - у OpenFreeMap глифы
// только Noto Sans, поэтому PBF-глифы JetBrains Mono сгенерированы (fontnik из официального
// .ttf) и лежат отдельно в public/fonts/JetBrains Mono Regular/*.pbf, style.json
// (public/map-style-*.json) ссылается на них через свой "glyphs" вместо внешнего хостинга.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

// Шрифт остального интерфейса (вне карты) - заменяет Iset Sans, см. styles/globals.css и
// components/UI/Typography/*.
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';

import 'styles/globals.css';

type AppProps<PropsType extends object> = {
    Component: React.ComponentType<PropsType>;
    pageProps: PropsType;
};

// ProjectsPanel (пакет `ekb`) убран - это виджет-переключатель между проектами
// ekaterinburg.dev, от которых отпочковался этот проект; к нашему деплою отношения не имеет.
function App({ Component, pageProps }: AppProps<any>) {
    return (
        <ThemeProvider>
            <FavoritesProvider>
                <IconSizesProvider>
                    <DevSettingsProvider>
                        <MapPreferencesProvider>
                            <Provider store={store}>
                                <SeoMeta />
                                <Splash />
                                <Component {...pageProps} />
                            </Provider>
                        </MapPreferencesProvider>
                    </DevSettingsProvider>
                </IconSizesProvider>
            </FavoritesProvider>
        </ThemeProvider>
    );
}

export default App;
