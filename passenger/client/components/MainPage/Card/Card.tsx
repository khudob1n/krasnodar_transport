import React, { useRef } from 'react';
import classNames from 'classnames/bind';
import t from 'utils/typograph';
import { STRAPI_URL } from 'transport-common/strapi/constants';

import { useHoverLift } from 'hooks/useHoverLift';

import { CARD_ICONS } from './cardIcons';
import { CardProps } from './Card.types';

import NewLink from './icon-external-link.svg';

import styles from './Card.module.css';

const CARD_TYPES_CLASSNAMES = {
    public: styles.Card_Public,
    car: styles.Card_Car,
    other: styles.Card_Other,
    pedestrian: styles.Card_Pedestrian,
};

const cn = classNames.bind(styles);

export function Card({
    title,
    titleBackgroundColor,
    type,
    url,
    size,
    backgroundImage,
    backgroundImageHover,
    dynamicContent,
    isMap = false,
    headerCaption,
    footerCaption,
    onClick,
}: CardProps) {
    const isExternalUrl = url?.includes('http');
    const Icon = CARD_ICONS[url];
    const cardRef = useRef<HTMLAnchorElement>(null);
    const hoverLift = useHoverLift(cardRef);

    return (
        <a
            ref={cardRef}
            {...hoverLift}
            className={cn(styles.Card, CARD_TYPES_CLASSNAMES[type], {
                [styles[`Card_Size-${size}`]]: size,
                [styles.Card_Map]: isMap,
            })}
            href={url}
            aria-label={
                isMap
                    ? `${title}. ${footerCaption || headerCaption || ''}. Открыть карту`
                    : undefined
            }
            onClick={onClick}
            target={isExternalUrl ? '_blank' : ''}
            rel={isExternalUrl ? 'noopener noreferrer' : undefined}
            style={
                {
                    '--CardTitleBgColor': titleBackgroundColor,
                    '--CardBgImage': backgroundImage && `url(${STRAPI_URL}${backgroundImage})`,
                    '--CardBgImageHover':
                        backgroundImageHover && `url(${STRAPI_URL}${backgroundImageHover})`,
                } as React.CSSProperties
            }
        >
            {title && (
                <div
                    className={cn(styles.CardTitle, {
                        [styles.CardTitle_Bg]: titleBackgroundColor,
                    })}
                >
                    {Icon && <Icon className={cn(styles.CardIcon)} stroke={2} aria-hidden="true" />}
                    <span className={cn(styles.CardTitleLabel)}>{t(title)}</span>
                    {isExternalUrl && <NewLink className={cn(styles.CardExternalLink)} />}
                </div>
            )}
            {headerCaption && <p className={cn(styles.CardHeaderCaption)}>{t(headerCaption)}</p>}
            {footerCaption && (
                <p
                    className={
                        headerCaption
                            ? cn(styles.CardFooterCaption)
                            : cn(styles.CardFooterCaption_NoSubtitle)
                    }
                >
                    {t(footerCaption)}
                </p>
            )}
            {isMap && (
                <span className={styles.CardMapAction}>
                    Открыть карту <span aria-hidden="true">↗</span>
                </span>
            )}
            {dynamicContent && (
                <div
                    className={cn(styles.CardDynamic)}
                    aria-hidden={isMap || undefined}
                    ref={(element) => {
                        if (element) element.inert = isMap;
                    }}
                >
                    {dynamicContent}
                </div>
            )}
        </a>
    );
}
