import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { authService } from '@/services/auth/auth.service'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/Login.vue'),
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('@/views/auth/AuthCallback.vue'),
  },
  {
    path: '/',
    component: () => import('@/components/layout/AdminLayout.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
      },
      {
        path: 'sales',
        name: 'sales',
        component: () => import('@/views/sales/SalesList.vue'),
      },
      {
        path: 'sales/:id',
        name: 'sale-details',
        component: () => import('@/views/sales/SaleDetails.vue'),
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/UsersList.vue'),
      },
      {
        path: 'users/:uuid',
        name: 'user-details',
        component: () => import('@/views/users/UserDetails.vue'),
      },
      {
        path: 'trade-offers',
        name: 'trade-offers',
        component: () => import('@/views/trade-offers/TradeOffersList.vue'),
      },
      {
        path: 'trade-offers/:uuid',
        name: 'trade-offer-details',
        component: () => import('@/views/trade-offers/TradeOfferDetails.vue'),
      },
      {
        path: 'inventory',
        name: 'inventory',
        component: () => import('@/views/inventory/InventoryList.vue'),
      },
      {
        path: 'inventory/:uuid',
        name: 'inventory-details',
        component: () => import('@/views/inventory/InventoryDetails.vue'),
      },
      {
        path: 'collectors',
        name: 'collectors',
        component: () => import('@/views/collectors/CollectorsList.vue'),
      },
      {
        path: 'collectors/review',
        name: 'collectors-review',
        component: () => import('@/views/collectors/CollectorsReview.vue'),
      },
      {
        path: 'collectors/catalog',
        name: 'collectors-catalog',
        component: () => import('@/views/collectors/CollectorsCatalog.vue'),
      },
      {
        path: 'collector-orders',
        name: 'collector-orders',
        component: () => import('@/views/collector-orders/CollectorOrdersList.vue'),
      },
      {
        path: 'products/create',
        name: 'create-product',
        component: () => import('@/views/products/CreateProduct.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
})

let sessionRestored = false

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (!sessionRestored) {
    sessionRestored = true
    try {
      await authService.bootstrapSession()
    } catch (err: any) {
      console.error('Error bootstrapping session:', err)
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next('/login')
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next('/login')
  }

  if (to.name === 'login' && authStore.isAuthenticated && authStore.isAdmin) {
    return next('/')
  }

  next()
})
