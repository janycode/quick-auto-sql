<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
}
#app {
  min-height: 100vh;
}
</style>
