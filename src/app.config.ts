export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/inventory/index',
    'pages/products/index',
    'pages/statistics/index',
    'pages/product-detail/index',
    'pages/product-edit/index',
    'pages/ingredient-detail/index',
    'pages/ingredient-edit/index',
    'pages/sale-records/index',
    'pages/stock-logs/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF8A50',
    navigationBarTitleText: '冷饮店管家',
    navigationBarTextStyle: 'white',
    backgroundColor: '#FFF9F5',
  },
  tabBar: {
    color: '#A09A94',
    selectedColor: '#FF8A50',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '点单',
      },
      {
        pagePath: 'pages/inventory/index',
        text: '库存',
      },
      {
        pagePath: 'pages/products/index',
        text: '产品',
      },
      {
        pagePath: 'pages/statistics/index',
        text: '统计',
      },
    ],
  },
})
