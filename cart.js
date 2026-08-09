// === 1. КОНФИГУРАЦИЯ FIREBASE (Замените на свои данные из консоли Firebase) ===
const firebaseConfig = {
  apiKey: "AIzaSyD4TDr8-UXWcUpN0vh6jRD6P4pPLnGbf-0",
  authDomain: "bjr-studio.firebaseapp.com",
  databaseURL: "https://bjr-studio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bjr-studio",
  storageBucket: "bjr-studio.firebasestorage.app",
  messagingSenderId: "666138636976",
  appId: "1:666138636976:web:70de21dd65c40a2989c175",
  measurementId: "G-54TCHJ5S34"
};


// === 2. ГЛОБАЛЬНЫЕ НАСТРОЙКИ ===
const IS_TEST_MODE = true; // Смените на false для реальной оплаты
const TG_BOT_TOKEN = '8784078820:AAEOp_92E8T5CYVksxzAIpxClG3g1CmLIfQ';
const TG_CHAT_ID = '493795575';

const STOCK_LIMITS = { S: 8, M: 14, L: 23 };
const PREORDER_LIMIT = 50; 
let globalSoldData = { S: 0, M: 0, L: 0 }; 

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const stockRef = database.ref('inventory');

document.addEventListener('DOMContentLoaded', () => {
  
  // === ТЕМА ===
  const themeToggle = document.getElementById('themeToggle');
  if (localStorage.getItem('bjr_theme') === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.body.classList.add('dark-theme');
  }
  themeToggle?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark-theme');
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('bjr_theme', isDark ? 'dark' : 'light');
  });

  // === FIREBASE LIVE ===
  stockRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        globalSoldData = data;
    } else {
        stockRef.set({ S: 0, M: 0, L: 0 });
    }
    renderCart();
    if (typeof prodSelectedSize !== 'undefined') updateBuyButtonState(prodSelectedSize);
  });

  function getActualRemaining(size) {
    const cleanSize = size.replace(' (PRE-ORDER)', '');
    return Math.max(0, STOCK_LIMITS[cleanSize] - (globalSoldData[cleanSize] || 0));
  }

  // === КОРЗИНА (STORAGE) ===
  function getCart() { try { return JSON.parse(localStorage.getItem('bjr_cart')) || []; } catch(e) { return []; } }
  function saveCart(cart) { localStorage.setItem('bjr_cart', JSON.stringify(cart)); }

  function showNotification(text, isError = false) {
    let container = document.getElementById('toastContainer') || document.body.appendChild(Object.assign(document.createElement('div'), {id:'toastContainer', className:'toast-container'}));
    const toast = document.createElement('div');
    toast.className = `toast-banner ${isError ? 'info' : ''}`;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('is-show'), 10);
    setTimeout(() => { toast.classList.remove('is-show'); setTimeout(() => toast.remove(), 400); }, 3000);
  }

  // === ЛОГИКА ЗАКАЗА ===
  async function sendOrderToTelegram(msg) {
    console.log("Отправка в Telegram...");
    const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(msg)}&parse_mode=HTML`;
    try {
      const resp = await fetch(url);
      const resData = await resp.json();
      if (!resData.ok) console.error("Ошибка TG API:", resData.description);
    } catch (e) { console.error("Ошибка сети TG:", e); }
  }

  function processFinalOrder() {
    console.log("Начало оформления заказа...");
    const cart = getCart();
    
    // Собираем данные
    const d = {
      email: document.getElementById('cartEmail')?.value.trim(),
      tg: document.getElementById('cartTelegram')?.value.trim() || "Не указан",
      fio: document.getElementById('shipFio')?.value.trim(),
      phone: document.getElementById('shipPhone')?.value.trim(),
      city: document.getElementById('shipCity')?.value.trim(),
      addr: document.getElementById('shipAddress')?.value.trim(),
      total: document.getElementById('modalCartTotal')?.textContent
    };

    // Динамический заголовок в зависимости от режима
    let header = IS_TEST_MODE ? '🧪 ТЕСТОВЫЙ ЗАКАЗ' : '⏳ ОЖИДАЕТСЯ ОПЛАТА';
    
    const message = `
${header}
-----------------------
<b>ТОВАРЫ:</b>
${cart.map(i => `• ${i.name} (${i.size}) x${i.qty}`).join('\n')}
<b>ИТОГО:</b> ${d.total}

<b>КОНТАКТЫ:</b>
Email: ${d.email} | TG: ${d.tg}

<b>ДОСТАВКА:</b>
${d.fio} | ${d.phone}
${d.city}, ${d.addr}
    `;

    // Транзакция в Firebase
    stockRef.transaction((current) => {
      if (current === null) return { S: 0, M: 0, L: 0 }; // Если база пуста
      
      for (let item of cart) {
        if (!item.size.includes('PRE-ORDER')) {
          if ((current[item.size] || 0) + item.qty > STOCK_LIMITS[item.size]) return; // Отмена
        }
      }
      cart.forEach(item => {
        if (!item.size.includes('PRE-ORDER')) current[item.size] = (current[item.size] || 0) + item.qty;
      });
      return current;
    }, async (error, committed) => {
      if (error) {
        showNotification("ОШИБКА БАЗЫ", true);
        console.error(error);
      } else if (!committed) {
        showNotification("ТОВАР РАСКУПЛЕН", true);
      } else {
        console.log("Firebase обновлен. Шлем ТГ...");
        await sendOrderToTelegram(message);
        showNotification(IS_TEST_MODE ? "ТЕСТ ЗАВЕРШЕН" : "ЗАКАЗ ОФОРМЛЕН");
        
        // Закрываем всё
        document.querySelectorAll('.guide-modal, .cart-modal').forEach(m => m.classList.remove('is-open'));
        
        if (IS_TEST_MODE) {
          setTimeout(() => { localStorage.removeItem('bjr_cart'); location.reload(); }, 2500);
        } else {
          window.location.href = "/pay.php?total=" + parseInt(d.total.replace(/\s/g, ''));
        }
      }
    });
  }

  // === КНОПКИ ===
  
  // Кнопка Оформить в корзине
  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (getCart().length === 0) return showNotification("КОРЗИНА ПУСТА", true);
    document.getElementById('cartModal').classList.remove('is-open');
    document.getElementById('shippingModal').classList.add('is-open');
  });

  // Кнопка Перейти к оплате в доставке
  document.getElementById('finalPayBtn')?.addEventListener('click', () => {
    const email = document.getElementById('cartEmail').value;
    const fio = document.getElementById('shipFio').value;
    const phone = document.getElementById('shipPhone').value;

    if (!email.includes('@')) return showNotification("УКАЖИТЕ EMAIL", true);
    if (fio.length < 5 || phone.length < 5) return showNotification("ЗАПОЛНИТЕ ДОСТАВКУ", true);

    const hasPO = getCart().some(i => i.size.includes('PRE-ORDER'));
    console.log("Наличие предзаказа в корзине:", hasPO);

    if (hasPO) {
      // ВАЖНО: Сначала закрываем окно доставки, чтобы увидеть окно предзаказа
      document.getElementById('shippingModal').classList.remove('is-open');
      document.getElementById('preOrderWarningModal').classList.add('is-open');
    } else {
      processFinalOrder();
    }
  });

  // Кнопка Я понимаю в окне предзаказа
  document.getElementById('confirmOrderBtn')?.addEventListener('click', processFinalOrder);

  // === ОСТАЛЬНАЯ ЛОГИКА (Cart, Render, Sizes) ===
  function addItemToCart(name, price, img, rawSize) {
    let cart = getCart();
    const cleanSize = rawSize.replace(' (PRE-ORDER)', '');
    const remaining = getActualRemaining(cleanSize);
    const inLocal = cart.find(i => i.size === cleanSize)?.qty || 0;

    if (remaining > inLocal && !rawSize.includes('PRE-ORDER')) {
      const idx = cart.findIndex(i => i.size === cleanSize);
      if (idx > -1) cart[idx].qty += 1;
      else cart.push({ name, price: Number(price), img, size: cleanSize, qty: 1 });
      showNotification(`${name} (${cleanSize}) ДОБАВЛЕН`);
    } else {
      const poSize = `${cleanSize} (PRE-ORDER)`;
      const poIdx = cart.findIndex(i => i.size === poSize);
      if (poIdx > -1) cart[poIdx].qty += 1;
      else cart.push({ name, price: Number(price), img, size: poSize, qty: 1 });
      showNotification(`ПРЕДЗАКАЗ ОФОРМЛЕН`, true);
    }
    saveCart(cart);
    renderCart();
    document.getElementById('cartModal').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function renderCart() {
    const cart = getCart();
    const cartBody = document.getElementById('cartBody');
    if (!cartBody) return;
    const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    if(document.getElementById('cartOpenBtn')) document.getElementById('cartOpenBtn').textContent = totalQty > 0 ? `Cart (${totalQty})` : 'Cart';
    if(document.getElementById('modalCartTotal')) document.getElementById('modalCartTotal').textContent = totalPrice.toLocaleString('ru-RU') + ' RUB';
    if(document.getElementById('modalCartCount')) document.getElementById('modalCartCount').textContent = totalQty > 0 ? `(${totalQty})` : '';

    if (cart.length === 0) {
      cartBody.innerHTML = '<p class="cart-empty-text">Ваша корзина пуста</p>';
      return;
    }
    cartBody.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-item-img"><img src="${item.img}"></div>
        <div class="cart-item-details">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-size">РАЗМЕР: ${item.size}</div>
          <div class="cart-item-price">${item.price.toLocaleString('ru-RU')} RUB</div>
          <div class="cart-item-controls">
            <div class="qty-selector">
              <button class="qty-btn minus-btn" data-index="${index}">-</button>
              <span class="qty-num">${item.qty}</span>
              <button class="qty-btn plus-btn" data-index="${index}">+</button>
            </div>
            <button class="cart-item-remove remove-btn" data-index="${index}">Удалить</button>
          </div>
        </div>
      </div>`).join('');

    cartBody.querySelectorAll('.plus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = cart[btn.dataset.index];
        addItemToCart(item.name, item.price, item.img, item.size);
      });
    });
    cartBody.querySelectorAll('.minus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.index;
        if (cart[idx].qty > 1) cart[idx].qty -= 1; else cart.splice(idx, 1);
        saveCart(cart); renderCart();
      });
    });
    cartBody.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cart.splice(btn.dataset.index, 1);
        saveCart(cart); renderCart();
      });
    });
  }

  function updateBuyButtonState(size) {
    const btn = document.getElementById('addToCartProdBtn');
    if (btn) btn.textContent = getActualRemaining(size) > 0 ? 'ADD TO CART' : 'PRE-ORDER';
  }

  // ЗАКРЫТИЕ
  const closeAll = () => {
    document.querySelectorAll('.cart-modal, .guide-modal').forEach(m => m.classList.remove('is-open'));
    document.body.style.overflow = '';
  };
  ['cartClose', 'cartOverlay', 'shippingClose', 'shippingOverlay', 'preOrderClose', 'preOrderOverlay', 'guideClose', 'guideOverlay'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', closeAll);
  });

  document.getElementById('cartOpenBtn')?.addEventListener('click', () => {
    document.getElementById('cartModal').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });

  const urlParams = new URLSearchParams(window.location.search);
  let prodSelectedSize = urlParams.get('size') || 'M';
  const sizeBtns = document.querySelectorAll('.size-btn');
  if (sizeBtns.length > 0) {
    sizeBtns.forEach(btn => {
      if (btn.dataset.size === prodSelectedSize) btn.classList.add('active');
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        prodSelectedSize = btn.dataset.size;
        if (document.getElementById('selectedSizeText')) document.getElementById('selectedSizeText').textContent = prodSelectedSize;
        updateBuyButtonState(prodSelectedSize);
      });
    });
    updateBuyButtonState(prodSelectedSize);
  }

  document.getElementById('addToCartProdBtn')?.addEventListener('click', () => {
    addItemToCart('BJR "Fairy Tale"', 2600, 'Tshirt-test.png', prodSelectedSize);
  });

  document.querySelector('.size-guide-btn')?.addEventListener('click', () => {
    document.getElementById('sizeGuideModal').classList.add('is-open');
  });

  renderCart();
});