import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/workspace',
    },
    {
      path: '/workspace',
      name: 'Workspace',
      component: () => import('@/views/workspace/Workspace.vue'),
    },
    {
      path: '/settings/ai',
      name: 'AiSettings',
      component: () => import('@/views/settings/AiSettings.vue'),
    },
  ],
})

export default router
