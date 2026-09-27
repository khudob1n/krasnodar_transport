import { useCallback, useEffect, useRef, useState } from 'react';

import { sidebarService } from 'services/sidebar/sidebar';

/**
 * Общий паттерн кнопок-переключателей карты (Info, «Рядом», настройки): держат "открыта ли моя
 * панель" локальным isOpen и полагаются на свой onClose, чтобы его сбросить. Проблема - сайдбар
 * на карте один на всех, и open() из другого места (клик по остановке/машине) молча подменяет
 * содержимое чужим, не вызывая ничей onClose (см. services/sidebar/sidebar.tsx - вызывать его
 * там нельзя, это сломало бы намеренное "открыть остановку, не закрывая карточку машины").
 * Поэтому isOpen синхронизируется через sidebarService.onReplaced: если после чужого open()
 * активным оказался не тот onClose, который зарегistrировала эта кнопка последним - её панель
 * подменили, сбрасываем isOpen.
 */
export function useSidebarPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const myOnCloseRef = useRef<VoidFunction | null>(null);

    useEffect(
        () =>
            sidebarService.onReplaced((activeOnClose) => {
                if (activeOnClose !== myOnCloseRef.current) {
                    myOnCloseRef.current = null;
                    setIsOpen(false);
                }
            }),
        [],
    );

    const open = useCallback((component: React.ReactElement) => {
        const onClose = () => {
            myOnCloseRef.current = null;
            setIsOpen(false);
        };

        myOnCloseRef.current = onClose;
        setIsOpen(true);
        sidebarService.open({ component, onClose });
    }, []);

    const close = useCallback(() => {
        sidebarService.close();
    }, []);

    return { isOpen, open, close };
}
