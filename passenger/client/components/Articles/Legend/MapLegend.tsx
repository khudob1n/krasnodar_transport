import React from 'react';

import { ClientUnit, StopType } from 'transport-common/types/masstrans';

import { TransportIcon } from 'components/UI/TransportIcon/TransportIcon';
import { StationIcon } from 'components/UI/StationIcon/StationIcon';
import { MapVehicleMarker } from 'components/Map/Vehicles/Marker/MapVehicleMarker';
import StarIcon from 'public/icons/star.svg';
import NoServiceIcon from 'public/icons/no-service.svg';

import stopStyles from 'components/Map/Stops/Item/MapStopsItem.module.css';
import railStyles from 'components/Map/Rail/Rail.module.css';
import styles from './MapLegend.module.css';

/**
 * Легенда карты для статьи «Как пользоваться картой» (шорткод [[legend]] в parseMarkdown).
 * Собрана из тех же компонентов, что рисуют карту, - поэтому значки здесь всегда совпадают
 * с тем, что пассажир видит на карте, и не устаревают при смене дизайна маркеров.
 */

function Row({ sample, title, children }: { sample: React.ReactNode; title: string; children?: React.ReactNode }) {
    return (
        <li className={styles.LegendRow}>
            <span className={styles.LegendSample} aria-hidden="true">
                {sample}
            </span>
            <span className={styles.LegendText}>
                <strong>{title}</strong>
                {children && <span>{children}</span>}
            </span>
        </li>
    );
}

function Vehicle({
    type,
    num,
    accessibility = false,
    warning = false,
}: {
    type: ClientUnit;
    num: string;
    accessibility?: boolean;
    warning?: boolean;
}) {
    return (
        <span className={styles.LegendVehicle}>
            <MapVehicleMarker
                id={`legend-${type}-${num}`}
                routeNumber={num}
                type={type}
                course={45}
                isCourseEast={false}
                accessibility={accessibility}
                warning={warning}
            />
        </span>
    );
}

function Stop({ type, state = 'idle' }: { type: StopType; state?: 'idle' | 'inactive' | 'selected' }) {
    const unit = type === StopType.TrollBus ? ClientUnit.Troll : (type as unknown as ClientUnit);
    return (
        <span
            className={`${stopStyles.MapStopsItemPin} ${stopStyles[`MapStopsItemPin_${state}`] ?? ''} ${
                styles.LegendPin
            }`}
            style={state === 'selected' ? { color: `var(--${unit})` } : undefined}
        >
            <TransportIcon type={type} variant="stop" alt="" />
        </span>
    );
}

function Station({ kind }: { kind: 'railway_station' | 'airport' | 'bus_terminal' }) {
    return (
        <span className={`${railStyles.RailMarkerPin} ${styles.LegendPin}`}>
            <StationIcon kind={kind} alt="" />
        </span>
    );
}

function Area({ kind }: { kind: 'tram' | 'troll' | 'bus' }) {
    return <span className={styles.LegendArea} style={{ '--AreaColor': `var(--${kind})` } as React.CSSProperties} />;
}

function Swatch({ color }: { color: string }) {
    return <span className={styles.LegendSwatch} style={{ backgroundColor: color }} />;
}

export function MapLegend() {
    return (
        <div className={styles.Legend}>
            <h3>Транспорт на карте</h3>
            <ul className={styles.LegendList}>
                <Row sample={<Vehicle type={ClientUnit.Bus} num="45" />} title="Автобус">
                    Острый конец капли смотрит туда, куда едет машина, рядом - номер маршрута.
                </Row>
                <Row sample={<Vehicle type={ClientUnit.Troll} num="3" />} title="Троллейбус" />
                <Row sample={<Vehicle type={ClientUnit.Tram} num="15" />} title="Трамвай" />
                <Row sample={<Vehicle type={ClientUnit.Bus} num="45" accessibility />} title="Низкопольный">
                    Рядом с номером - знак инвалидной коляски: у машины низкий пол, в неё удобно заехать с коляской.
                </Row>
                <Row sample={<Vehicle type={ClientUnit.Bus} num="45" warning />} title="Нет данных о маршруте">
                    Жёлтый треугольник: машина едет по направлению, которого нет в нашем справочнике, поэтому её остановки и линию маршрута показать не получится.
                </Row>
            </ul>

            <h3>Остановки</h3>
            <ul className={styles.LegendList}>
                <Row sample={<Stop type={StopType.Bus} />} title="Остановка автобуса" />
                <Row sample={<Stop type={StopType.Troll} />} title="Остановка троллейбуса" />
                <Row sample={<Stop type={StopType.TrollBus} />} title="Остановка троллейбуса и автобуса" />
                <Row sample={<Stop type={StopType.Tram} />} title="Остановка трамвая" />
                <Row sample={<Stop type={StopType.Bus} state="selected" />} title="Остановка на выбранном маршруте">
                    Когда выбрана машина, её остановки обведены цветом маршрута.
                </Row>
                <Row sample={<Stop type={StopType.Bus} state="inactive" />} title="Приглушённая остановка">
                    Бледные остановки не относятся к машине или остановке, которую вы выбрали.
                </Row>
            </ul>

            <h3>Вокзалы и аэропорт</h3>
            <ul className={styles.LegendList}>
                <Row sample={<Station kind="railway_station" />} title="Железнодорожная станция">
                    Вокзалы и платформы, в карточке - расписание электричек и поездов.
                </Row>
                <Row sample={<Station kind="bus_terminal" />} title="Автовокзал">
                    В карточке - расписание междугородних автобусов.
                </Row>
                <Row sample={<Station kind="airport" />} title="Аэропорт">
                    В карточке - вылеты и прилёты.
                </Row>
            </ul>

            <h3>Депо</h3>
            <ul className={styles.LegendList}>
                <Row sample={<Area kind="tram" />} title="Трамвайное депо" />
                <Row sample={<Area kind="troll" />} title="Троллейбусное депо" />
                <Row sample={<Area kind="bus" />} title="Автобусный парк">
                    Территории депо закрашены цветом своего вида транспорта.
                </Row>
            </ul>

            <h3>Цвета</h3>
            <ul className={styles.LegendList}>
                <Row sample={<Swatch color="var(--bus)" />} title="Зелёный - автобусы">
                    Машины, остановки, номера и линии маршрутов.
                </Row>
                <Row sample={<Swatch color="var(--troll)" />} title="Голубой - троллейбусы" />
                <Row sample={<Swatch color="var(--tram)" />} title="Оранжевый - трамваи" />
                <Row sample={<Swatch color="var(--train)" />} title="Фиолетовый - поезда и электрички" />
                <Row sample={<Swatch color="#2673c9" />} title="Синий - аэропорт" />
                <Row sample={<Swatch color="var(--bus-terminal)" />} title="Красный - автовокзалы" />
                <Row sample={<StarIcon className={styles.LegendStar} />} title="Оранжевая звезда - избранное">
                    Остановка или маршрут сохранены в избранное.
                </Row>
                <Row sample={<NoServiceIcon className={styles.LegendNoService} />} title="Красная плашка - транспорт не ходит">
                    Сегодня по остановке или станции нет рейсов, либо расписание не опубликовано.
                </Row>
            </ul>
        </div>
    );
}
