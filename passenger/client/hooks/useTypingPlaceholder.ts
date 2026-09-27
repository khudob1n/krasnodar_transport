import { useEffect, useState } from 'react';

import { onReducedMotionChange, prefersReducedMotion } from 'utils/reducedMotion';

const TYPE_MS = 130;
const ERASE_MS = 65;
const HOLD_MS = 2400;
const GAP_MS = 800;
const BLINK_MS = 530;
/** Каретка в конце печатающегося текста. */
const CARET = '|';

/**
 * Подсказка в пустом поле, которая «сама печатается»: фраза набирается по букве, стоит,
 * стирается, за ней следующая - так поле подсказывает, что в нём можно искать.
 *
 * Каретка стоит в конце: пока буквы набираются или стираются - горит ровно, в паузах мигает,
 * как у настоящего поля. Мигание делаем здесь: placeholder стилями не мигнуть.
 *
 * Возвращает текущий кусок фразы с кареткой или null, когда анимации нет (поле в фокусе, в нём текст,
 * или просят обойтись без движения) - тогда у поля остаётся обычный placeholder.
 * startFull - первая фраза сразу видна целиком (не печатается с пустого поля).
 * delay - сдвиг старта, чтобы соседние поля не печатали в такт.
 * caret - рисовать ли свою каретку; не нужна, когда в поле уже мигает настоящая (фокус).
 */
export function useTypingPlaceholder(
    phrases: string[],
    {
        active,
        startFull = false,
        delay = 0,
        caret = true,
    }: { active: boolean; startFull?: boolean; delay?: number; caret?: boolean },
): string | null {
    const [reduced, setReduced] = useState(true);
    const [text, setText] = useState<string | null>(null);
    // Каретка видна: всегда при наборе и стирании, в паузах - через раз (мигает).
    const [caretOn, setCaretOn] = useState(true);

    useEffect(() => {
        setReduced(prefersReducedMotion());
        return onReducedMotionChange(() => setReduced(prefersReducedMotion()));
    }, []);

    const key = phrases.join('\n');

    useEffect(() => {
        if (!active || reduced || !phrases.length) {
            setText(null);
            return undefined;
        }

        let index = 0;
        let length = startFull ? phrases[0].length : 0;
        let erasing = startFull;
        let timer: ReturnType<typeof setTimeout>;
        let blink: ReturnType<typeof setInterval> | undefined;

        // Пауза (фраза стоит целиком или поле пустое между фразами) - каретка мигает.
        const pause = (ms: number) => {
            blink = setInterval(() => setCaretOn((on) => !on), BLINK_MS);
            timer = setTimeout(() => {
                clearInterval(blink);
                setCaretOn(true);
                tick();
            }, ms);
        };

        const tick = () => {
            const phrase = phrases[index];

            if (!erasing) {
                length += 1;
                setText(phrase.slice(0, length));
                if (length >= phrase.length) {
                    erasing = true;
                    pause(HOLD_MS);
                    return;
                }
                timer = setTimeout(tick, TYPE_MS);
                return;
            }

            length -= 1;
            setText(phrase.slice(0, Math.max(length, 0)));
            if (length <= 0) {
                erasing = false;
                index = (index + 1) % phrases.length;
                pause(GAP_MS);
                return;
            }
            timer = setTimeout(tick, ERASE_MS);
        };

        setText(phrases[0].slice(0, length));
        setCaretOn(true);
        pause((startFull ? HOLD_MS : GAP_MS) + delay);

        return () => {
            clearTimeout(timer);
            clearInterval(blink);
        };
        // phrases сравниваем по содержимому (key), а не по ссылке на массив.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, reduced, key, startFull, delay]);

    return text === null ? null : `${text}${caret && caretOn ? CARET : ''}`;
}
