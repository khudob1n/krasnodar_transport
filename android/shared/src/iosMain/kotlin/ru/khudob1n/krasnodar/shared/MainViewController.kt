package ru.khudob1n.krasnodar.shared

import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

/** Точка входа для iOS-приложения (iosApp/ContentView.swift). */
fun MainViewController(): UIViewController = ComposeUIViewController { LiveMap() }
