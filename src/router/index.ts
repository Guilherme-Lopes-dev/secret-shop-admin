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
    meta: { requiresAuth: true },
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
        path: 'sales/summary',
        name: 'sales-summary',
        component: () => import('@/views/sales/SalesSummary.vue'),
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
        path: 'market-explorer',
        name: 'market-explorer',
        component: () => import('@/views/market-explorer/MarketExplorer.vue'),
      },
      {
        path: 'market-explorer/item',
        name: 'market-explorer-item',
        component: () => import('@/views/market-explorer/MarketExplorerItemDetail.vue'),
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
        path: 'collector-orders/:uuid',
        name: 'collector-order-detail',
        component: () => import('@/views/collector-orders/CollectorOrderDetail.vue'),
      },
      {
        path: 'dropship-orders',
        name: 'dropship-orders',
        component: () => import('@/views/dropship-orders/DropshipOrdersList.vue'),
      },
      {
        path: 'dropship-orders/:uuid',
        name: 'dropship-order-detail',
        component: () => import('@/views/dropship-orders/DropshipOrderDetail.vue'),
      },
      {
        path: 'products/create',
        name: 'create-product',
        component: () => import('@/views/products/CreateProduct.vue'),
      },
      {
        path: 'passes',
        name: 'passes',
        component: () => import('@/views/passes/PassConfig.vue'),
      },
      {
        path: 'antifraud',
        name: 'antifraud-policy',
        component: () => import('@/views/antifraud/AntifraudPolicy.vue'),
      },
      {
        path: 'discord',
        name: 'discord',
        component: () => import('@/views/discord/Discord.vue'),
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('@/views/reports/Reports.vue'),
      },
      {
        path: 'historico',
        name: 'historico',
        component: () => import('@/views/historico/Historico.vue'),
      },
      {
        path: 'coupons',
        name: 'coupons',
        component: () => import('@/views/coupons/CouponsList.vue'),
      },
      {
        path: 'coupons/new',
        name: 'coupon-new',
        component: () => import('@/views/coupons/CouponForm.vue'),
      },
      {
        path: 'coupons/:uuid/edit',
        name: 'coupon-edit',
        component: () => import('@/views/coupons/CouponForm.vue'),
      },
      {
        path: 'whatsapp/blast',
        name: 'whatsapp-blast',
        component: () => import('@/views/whatsapp/WhatsappBlast.vue'),
      },
      {
        path: 'match-history',
        name: 'match-history',
        component: () => import('@/views/match-history/MatchHistory.vue'),
      },
      {
        path: 'recommendations',
        name: 'recommendations',
        component: () => import('@/views/recommendations/RecommendationsList.vue'),
      },
      {
        path: 'swaps',
        name: 'swaps',
        component: () => import('@/views/swaps/SwapsList.vue'),
      },
      {
        path: 'news',
        name: 'news',
        component: () => import('@/views/news/NewsList.vue'),
      },
      {
        path: 'news/new',
        name: 'news-new',
        component: () => import('@/views/news/NewsForm.vue'),
      },
      {
        path: 'news/:uuid/edit',
        name: 'news-edit',
        component: () => import('@/views/news/NewsForm.vue'),
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

  if (to.name === 'login' && authStore.isAuthenticated) {
    return next('/')
  }

  next()
})
