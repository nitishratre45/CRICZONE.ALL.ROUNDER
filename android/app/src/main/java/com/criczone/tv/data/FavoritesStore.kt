package com.criczone.tv.data

import android.content.Context

class FavoritesStore(context: Context) {
    private val prefs = context.getSharedPreferences("criczone_favorites", Context.MODE_PRIVATE)
    fun getAll(): Set<String> = prefs.getStringSet("channel_ids", emptySet())?.toSet() ?: emptySet()
    fun toggle(id: String): Set<String> {
        val updated = getAll().toMutableSet().apply { if (!add(id)) remove(id) }
        prefs.edit().putStringSet("channel_ids", updated).apply()
        return updated
    }
}
