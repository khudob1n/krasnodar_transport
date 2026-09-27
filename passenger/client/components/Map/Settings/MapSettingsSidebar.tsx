import React, { useRef, useState } from 'react';
import classNames from 'classnames/bind';
import {
    IconBook,
    IconDeviceDesktop,
    IconDownload,
    IconMoon,
    IconRestore,
    IconSun,
    IconTrash,
    IconUpload,
    IconX,
} from '@tabler/icons-react';

import {
    ICON_SIZE_MAX,
    ICON_SIZE_MIN,
    ICON_SIZE_STEP,
    IconSizeKey,
    useIconSizes,
} from 'components/IconSizesProvider';
import { Typography } from 'components/UI/Typography/Typography';
import { ThemePreference, useTheme } from 'components/ThemeProvider';
import { useDevSettings } from 'components/DevSettingsProvider';
import { ICON_SIZES_STORAGE_KEY } from 'components/IconSizesProvider';
import { parseFavorites, useFavorites } from 'components/FavoritesProvider';
import {
    MAP_LAST_VIEW_STORAGE_KEY,
    MAP_PREFERENCES_STORAGE_KEY,
    MapLayerKey,
    MapPreferences,
    MaxTransfers,
    useMapPreferences,
} from 'components/MapPreferencesProvider';
import { Divider } from 'components/UI/Divider/Divider';
import { useSmoothCorners } from 'hooks/useSmoothCorners';

import pill from 'components/UI/PillButton/PillButton.module.css';
import { MapSettingsPreview } from './MapSettingsPreview';
import styles from './MapSettingsSidebar.module.css';

const cn = classNames.bind(styles);

const SLIDERS: { key: IconSizeKey; label: string; hint?: string }[] = [
    { key: 'vehicles', label: 'Транспорт на карте', hint: 'Автобусы, троллейбусы и трамваи' },
    { key: 'stops', label: 'Остановки' },
    { key: 'rail', label: 'Железнодорожные станции', hint: 'Вокзалы и платформы' },
    { key: 'airport', label: 'Аэропорт' },
    { key: 'other', label: 'Прочие объекты', hint: 'Автовокзалы' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof IconSun }[] = [
    { value: 'light', label: 'Светлая', Icon: IconSun },
    { value: 'dark', label: 'Тёмная', Icon: IconMoon },
    { value: 'system', label: 'Как в системе', Icon: IconDeviceDesktop },
];

/** Выбор одного из вариантов - полоса кнопок, выбранная контрастная (тема, подложка и т. п.). */
function Segmented<T extends string>({
    id,
    title,
    hint,
    options,
    value,
    onChange,
}: {
    id: string;
    /** Без заголовка группу подписывает элемент с этим id (например, заголовок раздела). */
    title?: string;
    hint?: string;
    options: { value: T; label: string; Icon?: typeof IconSun }[];
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div className={cn(styles.MapSettingsField)}>
            {title && (
                <span id={id} className={cn(styles.MapSettingsSliderLabel)}>
                    {title}
                    {hint && <span>{hint}</span>}
                </span>
            )}
            <div
                className={cn(styles.MapSettingsSegmented)}
                style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
                role="radiogroup"
                aria-labelledby={id}
            >
                {options.map(({ value: optionValue, label, Icon }) => (
                    <button
                        type="button"
                        role="radio"
                        aria-checked={value === optionValue}
                        className={cn(styles.MapSettingsSegment, {
                            [styles.MapSettingsSegment_active]: value === optionValue,
                            [styles.MapSettingsSegment_compact]: !Icon,
                        })}
                        onClick={() => onChange(optionValue)}
                        key={optionValue}
                    >
                        {Icon && <Icon size={18} stroke={2} aria-hidden="true" />}
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Переключатель на обычном чекбоксе с role="switch". */
function Switch({
    label,
    hint,
    checked,
    onChange,
    color,
}: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Цвет включённого тумблера - например, цвет вида транспорта. */
    color?: string;
}) {
    return (
        <label className={cn(styles.MapSettingsSwitchRow)}>
            <span className={cn(styles.MapSettingsSliderLabel)}>
                {label}
                {hint && <span>{hint}</span>}
            </span>
            <input
                type="checkbox"
                role="switch"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className={cn(styles.MapSettingsSwitch)}
                style={
                    color
                        ? ({ '--MapSettingsSwitchColor': color } as React.CSSProperties)
                        : undefined
                }
            />
        </label>
    );
}

/** Кнопка второстепенного действия - сквирл, как остальные кнопки в карточках. */
function ActionButton({
    Icon,
    children,
    onClick,
    disabled,
    danger,
    as = 'button',
    href,
}: {
    Icon: typeof IconSun;
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    as?: 'button' | 'a';
    href?: string;
}) {
    const ref = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
    useSmoothCorners(ref);
    const className = cn(pill.PillButton, styles.MapSettingsAction, {
        [styles.MapSettingsAction_danger]: danger,
    });
    const content = (
        <>
            <Icon className={pill.PillButtonIcon} aria-hidden="true" />
            <span>{children}</span>
        </>
    );

    return as === 'a' ? (
        <a ref={ref} className={className} href={href}>
            {content}
        </a>
    ) : (
        <button ref={ref} type="button" className={className} onClick={onClick} disabled={disabled}>
            {content}
        </button>
    );
}

function Section({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className={cn(styles.MapSettingsSection)} aria-labelledby={id}>
            <h3 id={id} className={cn(styles.MapSettingsSectionTitle)}>
                {title}
            </h3>
            {children}
        </section>
    );
}

/** Выбор темы - то же, что кнопка солнце/луна на карте, плюс вариант «как в системе». */
function ThemeChooser() {
    const { preference, setPreference } = useTheme();

    return (
        <Section id="theme-title" title="Тема">
            <Segmented
                id="theme-title"
                options={THEME_OPTIONS}
                value={preference}
                onChange={setPreference}
            />
        </Section>
    );
}

// Тумблеры видов транспорта - в цвет вида, как машины и линии на карте. Остановки и депо
// общие для всех видов, у них обычный цвет.
const LAYERS: { key: MapLayerKey; label: string; hint?: string; color?: string }[] = [
    { key: 'bus', label: 'Автобусы', color: 'var(--bus)' },
    { key: 'troll', label: 'Троллейбусы', color: 'var(--troll)' },
    { key: 'tram', label: 'Трамваи', color: 'var(--tram)' },
    {
        key: 'stops',
        label: 'Остановки',
        hint: 'Остановки скрытых видов транспорта не показываются',
    },
    {
        key: 'rail',
        label: 'Вокзалы и аэропорт',
        hint: 'Ж/д станции, автовокзалы, аэропорт',
        color: 'var(--train)',
    },
    { key: 'depots', label: 'Депо и автобусные парки' },
];

/** Слои, фильтр низкопольного транспорта и подписи (TASK-196, 197, 198). */
function MapContentSettings() {
    const { layers, setLayer, lowFloorOnly, showStale, labels, setPreference } =
        useMapPreferences();

    return (
        <Section id="layers-title" title="Что показывать на карте">
            <div className={cn(styles.MapSettingsList)}>
                {LAYERS.map(({ key, label, hint, color }) => (
                    <Switch
                        key={key}
                        label={label}
                        hint={hint}
                        color={color}
                        checked={layers[key]}
                        onChange={(value) => setLayer(key, value)}
                    />
                ))}
            </div>
            <div className={cn(styles.MapSettingsList, styles.MapSettingsList_separated)}>
                <Switch
                    label="Только низкопольный транспорт"
                    hint="Машины, в которые удобно заехать с коляской"
                    checked={lowFloorOnly}
                    onChange={(value) => setPreference('lowFloorOnly', value)}
                />
                <Switch
                    label="Машины без свежих координат"
                    hint="Больше 5 минут не присылали, где они, — показаны штриховкой"
                    checked={showStale}
                    onChange={(value) => setPreference('showStale', value)}
                />
                <Switch
                    label="Подписи на карте"
                    hint="Названия остановок, станций, вокзалов и депо"
                    checked={labels}
                    onChange={(value) => setPreference('labels', value)}
                />
            </div>
        </Section>
    );
}

/** Подложка, стартовая точка и «уменьшить движение» (TASK-199, 200, 201). */
function MapBehaviourSettings() {
    const { basemap, startView, reduceMotion, setPreference } = useMapPreferences();

    return (
        <Section id="map-title" title="Карта">
            <Segmented<MapPreferences['basemap']>
                id="basemap-choice"
                title="Подложка"
                hint="Упрощённая — без зданий и номеров домов, транспорт на ней заметнее"
                options={[
                    { value: 'default', label: 'Обычная' },
                    { value: 'simple', label: 'Упрощённая' },
                ]}
                value={basemap}
                onChange={(value) => setPreference('basemap', value)}
            />
            <Segmented<MapPreferences['startView']>
                id="start-view-choice"
                title="Где открывать карту"
                options={[
                    { value: 'center', label: 'Центр города' },
                    { value: 'location', label: 'Где я' },
                    { value: 'last', label: 'Последнее место' },
                ]}
                value={startView}
                onChange={(value) => setPreference('startView', value)}
            />
            <Switch
                label="Уменьшить движение"
                hint="Без анимаций и пульсации; машины переставляются раз в 30 секунд, а не едут плавно"
                checked={reduceMotion}
                onChange={(value) => setPreference('reduceMotion', value)}
            />
        </Section>
    );
}

/** Формат времени прибытия и вид карточки остановки (TASK-202, 203). */
function StopSettings() {
    const { arrivalFormat, stopDefaultView, setPreference } = useMapPreferences();

    return (
        <Section id="stops-title" title="Остановки">
            <Segmented<MapPreferences['arrivalFormat']>
                id="arrival-format-choice"
                title="Время прибытия"
                options={[
                    { value: 'relative', label: 'Через 5 мин' },
                    { value: 'absolute', label: 'В 14:32' },
                ]}
                value={arrivalFormat}
                onChange={(value) => setPreference('arrivalFormat', value)}
            />
            <Segmented<MapPreferences['stopDefaultView']>
                id="stop-view-choice"
                title="Карточка остановки открывается"
                options={[
                    { value: 'arrivals', label: 'С ближайшими' },
                    { value: 'schedule', label: 'С расписанием' },
                ]}
                value={stopDefaultView}
                onChange={(value) => setPreference('stopDefaultView', value)}
            />
        </Section>
    );
}

/** Поиск маршрута: сколько пересадок допускать. */
function JourneySettings() {
    const { maxTransfers, setPreference } = useMapPreferences();

    return (
        <Section id="journey-title" title="Маршрут">
            <Segmented<`${MaxTransfers}`>
                id="max-transfers-choice"
                title="Пересадок не больше"
                hint="Больше пересадок — больше вариантов, но они длиннее и сложнее"
                options={[
                    { value: '0', label: 'Без' },
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                ]}
                value={`${maxTransfers}`}
                onChange={(value) => setPreference('maxTransfers', Number(value) as MaxTransfers)}
            />
        </Section>
    );
}

/** Экспорт и импорт избранного файлом (TASK-204). */
function FavoritesTransfer() {
    const { stopIds, routeIds, stopNames, replaceFavorites } = useFavorites();
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<string | null>(null);
    const isEmpty = !stopIds.length && !routeIds.length;

    const exportFavorites = () => {
        const blob = new Blob([JSON.stringify({ stopIds, routeIds, stopNames }, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'izbrannoe-transport-krd.json';
        link.click();
        URL.revokeObjectURL(url);
        setStatus('Файл сохранён');
    };

    const importFavorites = async (file: File) => {
        const imported = parseFavorites(await file.text());

        if (!imported.stopIds.length && !imported.routeIds.length) {
            setStatus('В файле нет избранного');
            return;
        }

        // Объединяем с тем, что уже есть, - загрузка файла не должна молча стирать избранное.
        replaceFavorites({
            stopIds: Array.from(new Set([...stopIds, ...imported.stopIds])),
            routeIds: Array.from(new Set([...routeIds, ...imported.routeIds])),
            // Названия из файла не перетирают уже заданные на этом устройстве.
            stopNames: { ...imported.stopNames, ...stopNames },
        });
        setStatus(
            `Загружено: остановок — ${imported.stopIds.length}, маршрутов — ${imported.routeIds.length}`,
        );
    };

    return (
        <Section id="favorites-title" title="Избранное">
            <p className={cn(styles.MapSettingsNote)}>
                Избранное хранится только в этом браузере. Сохраните его в файл, чтобы перенести на
                другое устройство.
            </p>
            <div className={pill.PillButtonGrid}>
                <ActionButton Icon={IconDownload} onClick={exportFavorites} disabled={isEmpty}>
                    Сохранить в файл
                </ActionButton>
                <ActionButton Icon={IconUpload} onClick={() => inputRef.current?.click()}>
                    Загрузить из файла
                </ActionButton>
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) importFavorites(file);
                        event.target.value = '';
                    }}
                />
            </div>
            {status && (
                <p className={cn(styles.MapSettingsNote)} role="status">
                    {status}
                </p>
            )}
        </Section>
    );
}

// Всё, что приложение хранит в браузере. Кэши расписаний живут в памяти и уходят с
// перезагрузкой страницы.
const STORED_KEYS = [
    'favorites',
    'theme',
    ICON_SIZES_STORAGE_KEY,
    'dev-show-ids',
    MAP_PREFERENCES_STORAGE_KEY,
    MAP_LAST_VIEW_STORAGE_KEY,
];

/** «Сбросить всё» (TASK-205) - в два нажатия, чтобы не стереть избранное случайно. */
function ResetAll() {
    const [confirming, setConfirming] = useState(false);

    const resetAll = () => {
        try {
            STORED_KEYS.forEach((key) => localStorage.removeItem(key));
        } catch (e) {}
        window.location.reload();
    };

    return (
        <Section id="reset-title" title="Данные">
            <p className={cn(styles.MapSettingsNote)}>
                Удалит избранное, все настройки и сохранённые расписания. Страница перезагрузится.
            </p>
            <div className={pill.PillButtonGrid}>
                {confirming ? (
                    <>
                        <ActionButton Icon={IconTrash} onClick={resetAll} danger>
                            Да, сбросить всё
                        </ActionButton>
                        <ActionButton Icon={IconX} onClick={() => setConfirming(false)}>
                            Отмена
                        </ActionButton>
                    </>
                ) : (
                    <ActionButton Icon={IconTrash} onClick={() => setConfirming(true)}>
                        Сбросить всё
                    </ActionButton>
                )}
            </div>
        </Section>
    );
}

const formatDataDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

/** Справка, версия и дата данных внизу экрана (TASK-206, 207). */
function About() {
    const version = process.env.NEXT_PUBLIC_APP_VERSION;
    const dataDate = process.env.NEXT_PUBLIC_DATA_UPDATED_AT;

    return (
        <section
            className={cn(styles.MapSettingsSection, styles.MapSettingsAbout)}
            aria-label="О приложении"
        >
            <div className={pill.PillButtonGrid}>
                <ActionButton Icon={IconBook} as="a" href="/kak-chitat-kartu">
                    Как пользоваться картой
                </ActionButton>
            </div>
            <p className={cn(styles.MapSettingsNote)}>
                {version && <>Версия {version}</>}
                {version && dataDate && ' · '}
                {dataDate && <>данные от {formatDataDate(dataDate)}</>}
            </p>
        </section>
    );
}

/** Раздел «Для разработчиков»: внутренние ID в карточках остановок, маршрутов и машин. */
function DeveloperSettings() {
    const { showIds, setShowIds } = useDevSettings();

    return (
        <Section id="dev-title" title="Для разработчиков">
            <Switch
                label="Показывать ID в карточках"
                hint="ID остановок, маршрутов, направлений, машин и станций; клик копирует"
                checked={showIds}
                onChange={setShowIds}
            />
        </Section>
    );
}

function ResetButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    useSmoothCorners(buttonRef);

    return (
        <button
            ref={buttonRef}
            type="button"
            className={cn(pill.PillButton, styles.MapSettingsReset)}
            onClick={onClick}
            disabled={disabled}
        >
            <IconRestore className={pill.PillButtonIcon} aria-hidden="true" />
            <span>Сбросить</span>
        </button>
    );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

function SizeSlider({
    id,
    label,
    hint,
    value,
    onChange,
    main = false,
}: {
    id: string;
    label: string;
    hint?: string;
    value: number;
    onChange: (value: number) => void;
    main?: boolean;
}) {
    return (
        <div className={cn(styles.MapSettingsSlider, { [styles.MapSettingsSlider_main]: main })}>
            <div className={cn(styles.MapSettingsSliderHeader)}>
                <label htmlFor={id} className={cn(styles.MapSettingsSliderLabel)}>
                    {label}
                    {hint && <span>{hint}</span>}
                </label>
                <output htmlFor={id} className={cn(styles.MapSettingsSliderValue)}>
                    {percent(value)}
                </output>
            </div>
            <input
                id={id}
                type="range"
                min={ICON_SIZE_MIN}
                max={ICON_SIZE_MAX}
                step={ICON_SIZE_STEP}
                value={value}
                aria-valuetext={percent(value)}
                onChange={(event) => onChange(Number(event.target.value))}
                className={cn(styles.MapSettingsRange)}
            />
        </div>
    );
}

/**
 * Экран настроек карты: тема, слои, размеры значков, поведение карты, остановки, избранное. Общий ползунок умножается на ползунок вида
 * (см. --icon-scale-*-effective в styles/globals.css), изменения видны на карте сразу.
 */
export function MapSettingsSidebar() {
    const { sizes, setSize, reset, isDefault } = useIconSizes();

    return (
        <div className={cn(styles.MapSettingsSidebar)}>
            <div className={cn(styles.MapSettingsSidebarHeader)}>
                <Typography variant="h4">Настройки</Typography>
            </div>
            <Divider />
            <ThemeChooser />
            <Divider />
            {/* Мини-карта прилипает к верху панели, пока листаешь слои и размеры, - изменения
                видно сразу, не прокручивая назад. */}
            <div className={cn(styles.MapSettingsPreviewGroup)}>
                <div className={cn(styles.MapSettingsPreviewSticky)}>
                    <MapSettingsPreview />
                </div>
                <MapContentSettings />
                <Divider />
                <section
                    className={cn(styles.MapSettingsSection)}
                    aria-labelledby="icon-sizes-title"
                >
                    <h3 id="icon-sizes-title" className={cn(styles.MapSettingsSectionTitle)}>
                        Размер меток на карте
                    </h3>
                    <SizeSlider
                        id="icon-size-all"
                        label="Все метки"
                        hint="Общий масштаб, умножается на настройки ниже"
                        value={sizes.all}
                        onChange={(value) => setSize('all', value)}
                        main
                    />
                    {SLIDERS.map(({ key, label, hint }) => (
                        <SizeSlider
                            key={key}
                            id={`icon-size-${key}`}
                            label={label}
                            hint={hint}
                            value={sizes[key]}
                            onChange={(value) => setSize(key, value)}
                        />
                    ))}
                    <ResetButton onClick={reset} disabled={isDefault} />
                </section>
            </div>
            <Divider />
            <MapBehaviourSettings />
            <Divider />
            <StopSettings />
            <JourneySettings />
            <Divider />
            <FavoritesTransfer />
            <Divider />
            <DeveloperSettings />
            <Divider />
            <ResetAll />
            <Divider />
            <About />
        </div>
    );
}
