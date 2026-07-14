<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Country } from '@/utils/countries'

const props = defineProps<{ options: Country[]; placeholder?: string }>()
const emit = defineEmits<{ (e: 'select', code: string): void }>()

const query = ref('')
const open = ref(false)

const filtered = computed(() => {
    const q = query.value.trim().toLowerCase()
    const list = q
        ? props.options.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
        : props.options
    return list.slice(0, 60)
})

function pick(code: string) {
    emit('select', code)
    query.value = ''
    open.value = false
}

function onBlur() {
    // delay para o @mousedown do item disparar antes de fechar
    setTimeout(() => { open.value = false }, 150)
}
</script>

<template>
    <div class="country-picker">
        <input
            v-model="query"
            type="search"
            class="picker-input"
            :placeholder="placeholder || 'Buscar país…'"
            @focus="open = true"
            @blur="onBlur"
        />
        <ul v-if="open && filtered.length" class="picker-list">
            <li v-for="c in filtered" :key="c.code" @mousedown.prevent="pick(c.code)">
                <span class="picker-code">{{ c.code }}</span> {{ c.name }}
            </li>
        </ul>
        <p v-else-if="open" class="picker-empty">Nenhum país encontrado</p>
    </div>
</template>

<style lang="stylus" scoped>
.country-picker
    position relative
    width 100%

.picker-input
    width 100%
    background #0e1118
    border 1px solid #2a3242
    border-radius 6px
    padding 9px 12px
    color #e6e9ef
    &:focus
        outline none
        border-color #4b69ff

.picker-list
    position absolute
    z-index 20
    top calc(100% + 4px)
    left 0
    right 0
    max-height 240px
    overflow-y auto
    margin 0
    padding 4px
    list-style none
    background #161b26
    border 1px solid #2a3242
    border-radius 8px
    box-shadow 0 8px 24px rgba(0,0,0,.4)
    li
        padding 7px 10px
        border-radius 6px
        cursor pointer
        font-size 13px
        color #e6e9ef
        &:hover
            background #232a38

.picker-code
    font-weight 700
    margin-right 6px
    color #94a3b8

.picker-empty
    position absolute
    z-index 20
    top calc(100% + 4px)
    left 0
    right 0
    padding 8px 10px
    background #161b26
    border 1px solid #2a3242
    border-radius 8px
    color #6b7280
    font-size 13px
    font-style italic
</style>
