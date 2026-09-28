package ru.khudob1n.krasnodar.transport.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo

/** Ширина окна в dp (LocalConfiguration.screenWidthDp на Android - здесь для обеих платформ). */
@Composable
fun screenWidthDp(): Float = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.width.toDp().value }

/** Высота окна в dp. */
@Composable
fun screenHeightDp(): Float = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.height.toDp().value }
