import { useEffect, useState } from 'react';

import { onReducedMotionChange, prefersReducedMotion } from 'utils/reducedMotion';

/**
 * Начальное значение - false, потому что на сервере медиазапроса нет, а разметка
 * должна совпасть с серверной. Реальное значение подхватывается на первом эффекте,
 * до того как анимации успеют запуститься. Учитывает и настройку «Уменьшить движение».
 */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const sync = () => setReduced(prefersReducedMotion());

        sync();

        return onReducedMotionChange(sync);
    }, []);

    return reduced;
}
