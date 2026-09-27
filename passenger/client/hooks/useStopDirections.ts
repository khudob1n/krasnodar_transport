import { useEffect, useState } from 'react';

import { loadStopDirections, StopDirection } from 'api/ekb/domain';

/** Подписи направлений остановок (см. loadStopDirections); грузятся один раз на сессию. */
export function useStopDirections(): Map<string, StopDirection> | null {
    const [directions, setDirections] = useState<Map<string, StopDirection> | null>(null);

    useEffect(() => {
        let active = true;
        loadStopDirections()
            .then((result) => {
                if (active) setDirections(result);
            })
            .catch((error) => console.warn('Не удалось загрузить направления остановок', error));
        return () => {
            active = false;
        };
    }, []);

    return directions;
}
