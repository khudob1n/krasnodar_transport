package ru.khudob1n.krasnodar.transport.map

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

val LOCATION_PERMISSIONS = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

fun hasLocationPermission(context: Context) = LOCATION_PERMISSIONS.any {
    ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
}

/**
 * Положение пользователя, пока на него подписаны (map.locate({ watch: true }) на сайте): GPS и
 * сеть, что ответит; сначала последнее известное положение, если оно свежее минуты.
 */
@SuppressLint("MissingPermission")
fun locationUpdates(context: Context): Flow<Location> = callbackFlow {
    val manager = context.getSystemService(LocationManager::class.java)
    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter { manager.isProviderEnabled(it) }
    providers.mapNotNull { manager.getLastKnownLocation(it) }
        .filter { System.currentTimeMillis() - it.time < 60_000 }
        .maxByOrNull { it.time }?.let { trySend(it) }
    val listener = LocationListener { trySend(it) }
    for (provider in providers) manager.requestLocationUpdates(provider, 2_000L, 5f, listener, Looper.getMainLooper())
    if (providers.isEmpty() || !LocationManagerCompat.isLocationEnabled(manager)) close(IllegalStateException("Геолокация выключена"))
    awaitClose { manager.removeUpdates(listener) }
}
