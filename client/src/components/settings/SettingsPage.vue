<script lang="ts" setup name="SettingsPage">
</script>

<template>
  <div class="settings-page">
    <div class="settings-page__body">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  display: flex;
  justify-content: center;
  padding: 24px;

  &__body {
    width: 100%;
    max-width: 900px;
  }
}
</style>
