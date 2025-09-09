<script lang="ts" setup>
defineProps<{
  list: {
    text: string
    description?: string
    icon?: string
    href: string
  }[]
}>()
</script>

<template>
  <ul grid="~ cols-1 sm:cols-2 gap-4">
    <template v-if="!list || list.length === 0">
      <div py10 opacity-50 text-lg>
        nothing here yet.
      </div>
    </template>
    <li v-for="project in list" :key="project.text" w-full rd-2>
      <a
        text-lg lh-tight nav-link
        flex="~ col md:row gap-2 md:items-center"
        target="_blank"
        :href="project.href"
        :aria-label="project.text"
      >
        <div v-if="project.icon" ml-2 mr-4 pt-2 self-start w-10>
          <i text-4xl inline-block :class="project.icon" />
        </div>
        <div v-else ml-2 mr-4 pt-2 self-start w-10 aria-hidden="true" />
        <div font-normal lh-tight>
          <div><span lh-normal>{{ project.text }}</span></div>
          <div opacity-50 text-sm>{{ project.description }}</div>
        </div>
      </a>
    </li>
  </ul>
</template>
