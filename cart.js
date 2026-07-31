document.addEventListener('DOMContentLoaded', () => {
  
  // === 0. УПРАВЛЕНИЕ ТЕМОЙ (Светлая по умолчанию, без моргания) ===
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('bjr_theme');

  // Если тема сохранена как 'dark', применяем класс и к body
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.body.classList.add('dark-theme');
  } else {
    document.documentElement.classList.remove('dark-theme');
    document.body.classList.remove('dark-theme');
  }

  // Переключение темы по клику
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark-theme');
      document.body.classList.toggle('dark-theme', isDark);
      
      // Запоминаем выбор пользователя
      localStorage.setItem('bjr_theme', isDark ? 'dark' : 'light');

      // Анимация кнопки
      themeToggle.classList.add('theme-animating');
      setTimeout(() => themeToggle.classList.remove('theme-animating'), 500);
    });
  }

  // === 1. ЛИМИТЫ ТОВАРОВ НА СКЛАДЕ ===
  const STOCK_LIMITS = {
    S: 11,
    M: 14,
    L: 29
  };

  // === 2. ВСПЛЫВАЮЩИЕ ПЛАШКИ (Toast для товаров) ===
  function ensureToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showNotification(text, isLightVersion = false) {
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast-banner ${isLightVersion ? 'info' : ''}`;
    toast.textContent = text;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('is-show'), 10);

    setTimeout(() => {
      toast.classList.remove('is-show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // === 3. LOCAL STORAGE ===
  function getCart() {
    try {
      return JSON.parse(localStorage.getItem('bjr_cart')) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem('bjr_cart', JSON.stringify(cart));
  }

  function getRemainingStock(size, productName = 'BJR "Fairy Tale"') {
    const cleanSize = size.replace(' (PRE-ORDER)', '');
    const cart = getCart();
    const item = cart.find(i => i.name === productName && i.size.startsWith(cleanSize));
    const inCartQty = item ? item.qty : 0;
    const maxLimit = STOCK_LIMITS[cleanSize] || 0;
    return maxLimit - inCartQty;
  }

  function updateBuyButtonState(selectedSize) {
    const addToCartProdBtn = document.getElementById('addToCartProdBtn');
    if (!addToCartProdBtn) return;

    const cleanSize = selectedSize.replace(' (PRE-ORDER)', '');
    const remaining = getRemainingStock(cleanSize);

    if (remaining > 0) {
      addToCartProdBtn.textContent = 'ADD TO CART';
    } else {
      addToCartProdBtn.textContent = 'PRE-ORDER';
    }
  }

  // === 4. ОТРИСОВКА КОРЗИНЫ ===
  function renderCart() {
    const cart = getCart();
    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const cartOpenBtn = document.getElementById('cartOpenBtn');
    if (cartOpenBtn) {
      cartOpenBtn.textContent = totalQty > 0 ? `Cart (${totalQty})` : 'Cart';
    }

    const modalCartCount = document.getElementById('modalCartCount');
    if (modalCartCount) {
      modalCartCount.textContent = totalQty > 0 ? `(${totalQty})` : '';
    }

    const modalCartTotal = document.getElementById('modalCartTotal');
    if (modalCartTotal) {
      modalCartTotal.textContent = totalPrice.toLocaleString('ru-RU') + ' RUB';
    }

    const cartBody = document.getElementById('cartBody');
    if (!cartBody) return;

    if (cart.length === 0) {
      cartBody.innerHTML = '<p class="cart-empty-text">Ваша корзина пуста</p>';
      return;
    }

    cartBody.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${item.img}" alt="${item.name}">
        </div>
        <div class="cart-item-details">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-size">РАЗМЕР: ${item.size}</div>
          <div class="cart-item-price">${item.price.toLocaleString('ru-RU')} RUB</div>
          <div class="cart-item-controls">
            <div class="qty-selector">
              <button type="button" class="qty-btn minus-btn" data-index="${index}">-</button>
              <span class="qty-num">${item.qty}</span>
              <button type="button" class="qty-btn plus-btn" data-index="${index}">+</button>
            </div>
            <button type="button" class="cart-item-remove remove-btn" data-index="${index}">Удалить</button>
          </div>
        </div>
      </div>
    `).join('');

    cartBody.querySelectorAll('.plus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = getCart();
        const idx = btn.dataset.index;
        c[idx].qty += 1;
        saveCart(c);
        renderCart();
        if (typeof prodSelectedSize !== 'undefined') updateBuyButtonState(prodSelectedSize);
      });
    });

    cartBody.querySelectorAll('.minus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = getCart();
        const idx = btn.dataset.index;
        if (c[idx].qty > 1) {
          c[idx].qty -= 1;
        } else {
          c.splice(idx, 1);
        }
        saveCart(c);
        renderCart();
        if (typeof prodSelectedSize !== 'undefined') updateBuyButtonState(prodSelectedSize);
      });
    });

    cartBody.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = getCart();
        c.splice(btn.dataset.index, 1);
        saveCart(c);
        renderCart();
        if (typeof prodSelectedSize !== 'undefined') updateBuyButtonState(prodSelectedSize);
      });
    });

    if (typeof prodSelectedSize !== 'undefined') {
      updateBuyButtonState(prodSelectedSize);
    }
  }

  function addItemToCart(name, price, img, rawSize) {
    const cleanSize = rawSize.replace(' (PRE-ORDER)', '');
    const remaining = getRemainingStock(cleanSize, name);

    const size = remaining > 0 ? cleanSize : `${cleanSize} (PRE-ORDER)`;

    const cart = getCart();
    const existingIndex = cart.findIndex(item => item.name === name && item.size === size);

    if (existingIndex > -1) {
      cart[existingIndex].qty += 1;
    } else {
      cart.push({ name, price: Number(price), img, size, qty: 1 });
    }

    saveCart(cart);
    renderCart();
    openCart();
    updateBuyButtonState(cleanSize);

    if (remaining > 0) {
      showNotification(`${name} (${cleanSize}) ДОБАВЛЕН В КОРЗИНУ`);
    } else {
      showNotification(`ОФОРМЛЕН ПРЕДЗАКАЗ (PRE-ORDER) ДЛЯ РАЗМЕРА ${cleanSize}`, true);
    }
  }

  // === 5. МОДАЛЬНОЕ ОКНО ===
  const cartModal = document.getElementById('cartModal');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose = document.getElementById('cartClose');
  const cartOpenBtn = document.getElementById('cartOpenBtn');

  function openCart() {
    if (cartModal) {
      cartModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCart() {
    if (cartModal) {
      cartModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  if (cartOpenBtn) cartOpenBtn.addEventListener('click', openCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartModal && cartModal.classList.contains('is-open')) {
      closeCart();
    }
  });

  // === 6. СТРАНИЦА ТОВАРА ===
  const urlParams = new URLSearchParams(window.location.search);
  const sizeFromUrl = urlParams.get('size');
  let prodSelectedSize = sizeFromUrl || 'M';

  const prodSizeBtns = document.querySelectorAll('.info-card .size-btn');
  const selectedSizeText = document.getElementById('selectedSizeText');

  if (prodSizeBtns.length > 0) {
    prodSizeBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.size === prodSelectedSize) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        prodSizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        prodSelectedSize = btn.dataset.size;
        if (selectedSizeText) selectedSizeText.textContent = prodSelectedSize;
        
        updateBuyButtonState(prodSelectedSize);

        if (getRemainingStock(prodSelectedSize) <= 0) {
          showNotification(`РАЗМЕР ${prodSelectedSize} РАСКУПЛЕН. ДОСТУПЕН ПРЕДЗАКАЗ`, true);
        }
      });
    });

    if (selectedSizeText) selectedSizeText.textContent = prodSelectedSize;
  }

  const addToCartProdBtn = document.getElementById('addToCartProdBtn');
  if (addToCartProdBtn) {
    addToCartProdBtn.addEventListener('click', () => {
      addItemToCart('BJR "Fairy Tale"', 2600, 'Tshirt-test.png', prodSelectedSize);
    });
  }

  renderCart();
  updateBuyButtonState(prodSelectedSize);
});