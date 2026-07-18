var MAP = [
  "xrrxxxxxxxxrrx",   // 0: screens at 1,2 and 11,12
  "xsxxxxppxxxssx",   // 1: seat@1, podium@6-7, seats@11-12 (under screen R)
  "xxxxxxxxxxxxxq",   // 2: EXIT@13 (below podium, above row A)
  "sssxssssssxsss",   // 3: Row A
  "sssxssssssxsss",   // 4: Row B
  "sssxssssssxsss",   // 5: Row C
  "sssxssssssxsss",   // 6: Row D
  "sssxssssssxsss",   // 7: Row E
  "sssxssssssxsss",   // 8: Row F
  "sssxssssssxsss",   // 9: Row G
  "sssxssssssxsss",   // 10: Row H
  "sssxssssssxsss",   // 11: Row I
  "sssxssssssxsss",   // 12: Row J
  "sssxssssssxsss",   // 13: Row K
  "sssxssssssxsss",   // 14: Row L
  "xxxxxxxxxxxxxx",   // 15: corridor
  "xxxxxxxxxxxxxx",   // 16: corridor
  "qxxxxtxxtxvvvx",   // 17: EXIT@0, TATIB@5&8, AV@10-12 (doors replaced with x)
  "wwwwwwwwwwwwww",   // 18: wall
  "xsxsxpxxxxxxxx",   // 19: R2 front row + podium
  "sssssxxxxxxxxx",   // 20: R2-A
  "sssssxxxxxxxxx",   // 21: R2-B
  "sssssxxxxxxxxx",   // 22: R2-C
  "sssssxxxxxxxxx",   // 23: R2-D
  "sssssxxxxxxxxx"    // 24: R2-E
];
var ROWS = MAP.length, COLS = 14;
var STORAGE_KEY = 'cinema_venue_v14';
var reservations = {};
try { reservations = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) {}

// Firebase sync setup (optional - requires config in index.html)
var db = null;
var stateDocRef = null;
var usingFirebase = false;

try {
  if (typeof firebase !== 'undefined' && typeof firebase.firestore !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey !== "PASTE_API_KEY") {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    stateDocRef = db.collection('tangci').doc('state');
    usingFirebase = true;
  }
} catch(e) { console.warn('[Firebase] Not configured, using localStorage only.', e); }

// Load initial state (Firebase async or localStorage sync)
if (usingFirebase && stateDocRef) {
  stateDocRef.onSnapshot(function(doc) {
    if (doc.exists) {
      var data = doc.data();
      reservations = data.reservations || {};
      if (data.hiddenRows) {
        hiddenRows = new Set(data.hiddenRows);
      }
      render();
    }
  });
}

// ====== AUTH & ROLE ======
var auth = null;
var currentUser = null;
var currentRole = null; // admin, operator, podium

try {
  if (usingFirebase && typeof firebase.auth !== 'undefined') {
    auth = firebase.auth();
    auth.onAuthStateChanged(function(user) {
      currentUser = user;
      if (user && user.email) {
        // Check role in Firestore users collection
        db.collection('users').doc(user.email).get().then(function(docSnap) {
          if (docSnap.exists) {
            currentRole = docSnap.data().role || 'podium';
            // Auto-set admin if email matches ADMIN_EMAIL
            if (user.email === ADMIN_EMAIL) {
              currentRole = 'admin';
              db.collection('users').doc(user.email).set({ role: 'admin', email: user.email }, { merge: true });
            }
          } else {
            // No user doc found; default to podium unless admin email
            if (user.email === ADMIN_EMAIL) {
              currentRole = 'admin';
              db.collection('users').doc(user.email).set({ role: 'admin', email: user.email }, { merge: true });
            } else {
              currentRole = 'podium';
              db.collection('users').doc(user.email).set({ role: 'podium', email: user.email }, { merge: true });
            }
          }
          applyRoleAccess();
          render();
        }).catch(function(err) {
          console.warn('[Role] Error reading role:', err);
          currentRole = user.email === ADMIN_EMAIL ? 'admin' : 'podium';
          applyRoleAccess();
          render();
        });
      } else {
        currentRole = null;
        applyRoleAccess();
        render();
      }
      updateAuthUI();
    });
  }
} catch(e) { console.warn('[Auth] Init error:', e); }

function applyRoleAccess() {
  // Admin: can do everything (already handled by not blocking)
  // Operator: can edit seats + reset; cannot change role
  // Podium: only podium view
  if (currentRole === 'podium') {
    // Force podium view only
    currentPOV = 'podium';
    switchPOV('podium');
    // Hide operator buttons
    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.style.display = 'none';
    var rowVisBtn = document.getElementById('rowVisBtn');
    if (rowVisBtn) rowVisBtn.style.display = 'none';
  } else if (currentRole === 'operator') {
    // Allow editing but not admin features
    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.style.display = '';
    var rowVisBtn = document.getElementById('rowVisBtn');
    if (rowVisBtn) rowVisBtn.style.display = '';
  } else if (currentRole === 'admin') {
    // Full access
    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.style.display = '';
    var rowVisBtn = document.getElementById('rowVisBtn');
    if (rowVisBtn) rowVisBtn.style.display = '';
  }
}

function updateAuthUI() {
  // Create or update login button area
  var nav = document.querySelector('.bottom-nav');
  var existing = document.getElementById('authArea');
  if (existing) existing.remove();
  
  var authDiv = document.createElement('div');
  authDiv.id = 'authArea';
  authDiv.style.cssText = 'display:flex;gap:8px;align-items:center;margin-left:auto;';
  
  if (currentUser && currentUser.email) {
    authDiv.innerHTML = '<span style="font-size:.7rem;color:#9ca3af;">' + escHtml(currentUser.email) + ' (' + escHtml(currentRole || 'guest') + ')</span>' +
      '<button class="nav-btn" onclick="signOutApp()" style="font-size:.75rem;padding:6px 12px;background:#7f1d1d;border-color:#991b1b;color:#fca5a5;">Logout</button>';
    if (currentRole === 'admin') {
      authDiv.innerHTML += '<button class="nav-btn" onclick="openAdminPanel()" style="font-size:.75rem;padding:6px 12px;background:#1c2d48;border-color:#2c4a78;color:#8fc8ff;">Roles</button>';
    }
  } else {
    authDiv.innerHTML = '<button class="nav-btn" onclick="signInApp()" style="font-size:.75rem;padding:6px 12px;background:#22c55e;border-color:#22c55e;color:#05210f;font-weight:700;">Login Gmail</button>';
  }
  
  if (nav) nav.appendChild(authDiv);
}

function signInApp() {
  if (!auth) { alert('Firebase Auth belum siap'); return; }
  var provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(function(err) { console.warn('[Auth] Error:', err); alert('Login gagal'); });
}

function signOutApp() {
  if (!auth) return;
  auth.signOut();
}

// Admin panel to change roles
function openAdminPanel() {
  if (currentRole !== 'admin') { alert('Hanya admin'); return; }
  // Create a simple overlay
  var overlay = document.createElement('div');
  overlay.id = 'adminOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,7,12,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = '<div style="background:#171c27;border:1px solid #2b3245;border-radius:14px;padding:24px;width:min(92vw,420px);box-shadow:0 30px 80px rgba(0,0,0,.55);color:#e5e7eb;">' +
    '<h3 style="margin-top:0;color:#e5e7eb;font-size:1.1rem;">Atur Role User</h3>' +
    '<p style="font-size:.8rem;color:#9ca3af;margin-bottom:16px;">Masukkan email dan pilih role.</p>' +
    '<input id="adminEmailIn" type="email" placeholder="email@gmail.com" style="width:100%;padding:10px;background:#10141d;border:1px solid #2f374c;color:#e5e7eb;border-radius:8px;margin-bottom:10px;box-sizing:border-box;">' +
    '<select id="adminRoleSel" style="width:100%;padding:10px;background:#10141d;border:1px solid #2f374c;color:#e5e7eb;border-radius:8px;margin-bottom:10px;box-sizing:border-box;">' +
    '<option value="admin">Admin</option><option value="operator">Operator</option><option value="podium">Podium</option>' +
    '</select>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px;">' +
    '<button onclick="document.getElementById(\'adminOverlay\').remove()" style="padding:8px 16px;background:#252c3b;border:1px solid #364057;color:#d1d5db;border-radius:8px;cursor:pointer;font-size:.8rem;">Batal</button>' +
    '<button onclick="saveAdminRole()" style="padding:8px 16px;background:#22c55e;border:1px solid #22c55e;color:#05210f;border-radius:8px;cursor:pointer;font-size:.8rem;font-weight:600;">Simpan</button>' +
    '</div></div>';
  document.body.appendChild(overlay);
}

function saveAdminRole() {
  var email = document.getElementById('adminEmailIn').value.trim();
  var role = document.getElementById('adminRoleSel').value;
  if (!email || !email.includes('@')) { alert('Email tidak valid'); return; }
  if (email === ADMIN_EMAIL) { alert('Admin tidak bisa diubah'); return; }
  if (!db) { alert('Firebase belum siap'); return; }
  db.collection('users').doc(email).set({ role: role, email: email }, { merge: true })
    .then(function() { alert('Role ' + email + ' = ' + role); document.getElementById('adminOverlay').remove(); })
    .catch(function(err) { alert('Gagal: ' + err); });
}

// ====== END AUTH & ROLE ======

// Row visibility – A-L (map rows 3-14). hiddenRows is a Set of letters to HIDE.
var ALL_ROW_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
var HIDDEN_KEY = 'cinema_hidden_rows_v14';
var hiddenRows = new Set();
try {
  var stored = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  stored.forEach(function(l){ hiddenRows.add(l); });
} catch(e) {}

// Temp state while dropdown is open
var tempHidden = new Set();

var MERGE_GROUPS = [
  { row:0, minCol:1,  maxCol:2,  label:'SCREEN L', cls:'screen-block' },
  { row:0, minCol:11, maxCol:12, label:'SCREEN R', cls:'screen-block' },
  { row:1, minCol:6,  maxCol:7,  label:'PODIUM',   cls:'podium-block' }
];

var LABEL_COLS = [3, 10];

var currentPOV = 'av';
var currentSeat = null;
var floorEl = document.getElementById('floor');
var povTitle = document.getElementById('povTitle');
var navAvBtn = document.getElementById('navAvPov');
var navPodiumBtn = document.getElementById('navPodiumPov');
var modalOverlay = document.getElementById('modalOverlay');
var modalBox = document.getElementById('modalBox');
var nameInput = document.getElementById('nameInput');
var modalTitle = document.getElementById('modalTitle');
var clearBtnEl = document.getElementById('clearBtn');

function switchPOV(pov) {
  currentPOV = pov;
  var resetBtn = document.getElementById('resetBtn');
  var rowVisBtn = document.getElementById('rowVisBtn');
  if (pov === 'av') {
    povTitle.textContent = ' AV';
    povTitle.className = 'pov-title av';
    navAvBtn.style.background = '#1c2d48';
    navAvBtn.style.color = '#8fc8ff';
    navAvBtn.style.borderColor = '#2c4a78';
    navPodiumBtn.style.background = '#1d2331';
    navPodiumBtn.style.color = '#b9c2d5';
    navPodiumBtn.style.borderColor = '#2c3448';
    resetBtn.style.display = '';
    rowVisBtn.style.display = '';
  } else {
    povTitle.textContent = ' PODIUM';
    povTitle.className = 'pov-title podium';
    navPodiumBtn.style.background = '#3b2336';
    navPodiumBtn.style.color = '#f5a9d0';
    navPodiumBtn.style.borderColor = '#5c3050';
    navAvBtn.style.background = '#1d2331';
    navAvBtn.style.color = '#b9c2d5';
    navAvBtn.style.borderColor = '#2c3448';
    resetBtn.style.display = 'none';
    rowVisBtn.style.display = 'none';
  }
  render();
}

function getMergeGroup(r, c) {
  for (var i = 0; i < MERGE_GROUPS.length; i++) {
    var g = MERGE_GROUPS[i];
    if (r === g.row && c >= g.minCol && c <= g.maxCol) return g;
  }
  return null;
}

function getCellInfo(r, origC) {
  // Row letters at aisle cols 3 and 10, rows 3-14
  if (r >= 3 && r <= 14 && LABEL_COLS.indexOf(origC) !== -1) {
    return { type: 'label', label: String.fromCharCode(65 + r - 3) };
  }

  var ch = MAP[r] ? MAP[r][origC] : null;
  if (!ch || ch === 'x') return { type: 'space' };
  if (ch === 'w') return { type: 'wall' };
  if (ch === 'q') return { type: 'static', cls: 'exit-q', label: 'EXIT' };
  if (ch === 'd') return { type: 'static', cls: 'door', label: 'DOOR' };

  var mg = getMergeGroup(r, origC);
  if (mg) return { type: 'merge', group: mg, isStart: origC === mg.minCol };

  // Row 1 seats: col 1 (under screen L, labeled "x"), cols 11-12 (under screen R, labeled 1,2)
  if (r === 1 && ch === 's') {
    if (origC === 1) {
      return { type: 'seat', id: 'TOP-L', label: 'x' };
    } else if (origC === 11 || origC === 12) {
      var pos = origC - 10;
      return { type: 'seat', id: 'TOP-R' + pos, label: String(pos) };
    }
  }

  // Main hall seats (rows 3-14)
  if (ch === 's' && r >= 3 && r <= 14) {
    var seatCols = [0,1,2,4,5,6,7,8,9,11,12,13];
    var idx = seatCols.indexOf(origC);
    if (idx !== -1) {
      var id = String.fromCharCode(65 + r - 3) + (idx + 1);
      return { type: 'seat', id: id, label: String(idx + 1) };
    }
  }

  // TATIB at row 17, cols 5 and 8
  if (ch === 't' && r === 17) {
    var tn = origC === 5 ? '1' : '2';
    return { type: 'seat', id: 'TATIB-' + tn, label: 'TATIB' };
  }
  // AV at row 17, cols 10, 11, 12
  if (ch === 'v' && r === 17) {
    var an = String(origC - 9);
    return { type: 'seat', id: 'AV-' + an, label: 'AV' };
  }

  // Second room front seats (row 19, cols 1 & 3)
  if (r === 19 && ch === 's' && (origC === 1 || origC === 3)) {
    var sid = origC === 1 ? 'R2-F1' : 'R2-F2';
    return { type: 'seat', id: sid, label: 'S' };
  }

  // Second room podium (row 19, col 5)
  if (r === 19 && ch === 'p' && origC === 5) {
    return { type: 'r2podium', id: 'R2-PODIUM', label: 'PDM' };
  }

  // Second room seats (rows 20-24, cols 0-4)
  if (ch === 's' && r >= 20 && r <= 24 && origC <= 4) {
    var rl = ['A','B','C','D','E'][r - 20];
    var rid = 'R2-' + rl + (origC + 1);
    return { type: 'seat', id: rid, label: String(origC + 1) };
  }

  return { type: 'space' };
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isRowHidden(r) {
  // Main hall rows: 3-14 map to A-L
  if (r >= 3 && r <= 14) {
    return hiddenRows.has(String.fromCharCode(65 + r - 3));
  }
  return false;
}

// ---- Row visibility UI ----
function toggleRowVis() {
  var dd = document.getElementById('rowVisDropdown');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open');
  } else {
    // Load current hidden into temp
    tempHidden = new Set(hiddenRows);
    renderRowVisList();
    dd.classList.add('open');
  }
}

function closeRowVis(e) {
  if (e) e.stopPropagation();
  document.getElementById('rowVisDropdown').classList.remove('open');
}

function selectAllRows(e) {
  if (e) e.stopPropagation();
  tempHidden = new Set();
  renderRowVisList();
}

function toggleRowItem(letter, e) {
  if (e) e.stopPropagation();
  if (tempHidden.has(letter)) {
    tempHidden.delete(letter);
  } else {
    tempHidden.add(letter);
  }
  renderRowVisList();
}

function renderRowVisList() {
  var list = document.getElementById('rowVisList');
  list.innerHTML = '';
  ALL_ROW_LETTERS.forEach(function(letter) {
    var item = document.createElement('div');
    item.className = 'row-vis-item' + (tempHidden.has(letter) ? '' : ' checked');
    item.textContent = letter;
    item.onclick = function(e) { toggleRowItem(letter, e); };
    list.appendChild(item);
  });
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations)); } catch(e) {}
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(hiddenRows))); } catch(ex) {}
  if (usingFirebase && stateDocRef) {
    stateDocRef.set({
      reservations: reservations,
      hiddenRows: Array.from(hiddenRows)
    }).catch(function(err) { console.warn('[Firebase] Save error:', err); });
  }
}

function applyRowVis(e) {
  if (e) e.stopPropagation();
  hiddenRows = new Set(tempHidden);
  saveState();
  document.getElementById('rowVisDropdown').classList.remove('open');
  render();
  showToast('Rows updated');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('rowVisBtn');
  var dd = document.getElementById('rowVisDropdown');
  if (dd.classList.contains('open') && !dd.contains(e.target) && e.target !== wrap) {
    dd.classList.remove('open');
  }
});

function render() {
  floorEl.innerHTML = '';
  var clickable = 0, reserved = 0;
  var isEditable = currentPOV === 'av';
  var isPodium = currentPOV === 'podium';
  var renderedMerges = {};
  var displayR = 0;

  for (var mapR = 0; mapR < ROWS; mapR++) {
    var r = isPodium ? (ROWS - 1 - mapR) : mapR;

    // Skip hidden rows (only main hall rows 3-14 can be hidden)
    if (isRowHidden(r)) continue;

    for (var displayC = 0; displayC < COLS; displayC++) {
      var origC = isPodium ? (COLS - 1 - displayC) : displayC;
      var info = getCellInfo(r, origC);

      if (info.type === 'merge') {
        var g = info.group;
        var mergeKey = g.row + '_' + g.minCol;
        if (!info.isStart) continue;
        if (renderedMerges[mergeKey]) continue;
        renderedMerges[mergeKey] = true;

        var startDC, span;
        if (isPodium) {
          startDC = COLS - 1 - g.maxCol;
          span = g.maxCol - g.minCol + 1;
        } else {
          startDC = g.minCol;
          span = g.maxCol - g.minCol + 1;
        }

        var el = document.createElement('div');
        el.className = 'cell merge ' + g.cls;
        el.style.gridColumn = (startDC + 1) + ' / ' + (startDC + 1 + span);
        el.style.gridRow = (displayR + 1) + ' / ' + (displayR + 2);
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.textContent = g.label;
        floorEl.appendChild(el);
        continue;
      }

      var cell = document.createElement('div');
      cell.className = 'cell';

      if (info.type === 'seat') {
        clickable++;
        cell.classList.add('seat');
        if (!isEditable) cell.classList.add('readonly');
        var nm = reservations[info.id];
        if (nm) {
          reserved++;
          cell.classList.add('filled');
          // Dynamic font size to fit name on one line (optimized for 32px mobile cells)
          var nameLen = nm.length;
          var fontSize;
          if (nameLen <= 4) fontSize = 0.45;
          else if (nameLen <= 6) fontSize = 0.38;
          else if (nameLen <= 8) fontSize = 0.32;
          else if (nameLen <= 10) fontSize = 0.28;
          else if (nameLen <= 12) fontSize = 0.24;
          else fontSize = 0.20;
          cell.innerHTML = '<span class="nm" style="font-size:' + fontSize.toFixed(2) + 'rem">' + escHtml(nm) + '</span>';
          cell.title = info.id + ' – ' + nm;
          
          // In podium view, make filled seats clickable to show name
          if (!isEditable) {
            (function(sid, name) {
              cell.style.cursor = 'pointer';
              cell.onclick = function(e) {
                e.stopPropagation();
                showNamePopup(sid, name);
              };
            })(info.id, nm);
          }
        } else {
          cell.textContent = info.label;
          cell.title = info.id;
        }
        if (isEditable) {
          (function(sid) {
            cell.onclick = function(e) {
              e.stopPropagation();
              openModal(sid);
            };
          })(info.id);
        }
      } else if (info.type === 'label') {
        cell.classList.add('label-row');
        cell.textContent = info.label;
        cell.title = 'Row ' + info.label;
      } else if (info.type === 'static') {
        cell.classList.add(info.cls);
        cell.textContent = info.label;
      } else if (info.type === 'wall') {
        cell.classList.add('wall-row');
        var isDoorPos = (r === 18 && (origC === 6 || origC === 7));
        cell.innerHTML = '<div class="wall-line' + (isDoorPos ? ' door' : '') + '"></div>';
      } else if (info.type === 'r2podium') {
        cell.classList.add('r2-podium');
        cell.textContent = info.label;
        cell.title = info.id;
      } else {
        cell.classList.add('space');
      }

      floorEl.appendChild(cell);
    }
    displayR++;
  }
  document.getElementById('stats').textContent = reserved + ' / ' + clickable + ' reserved';
}

function openModal(id) {
  currentSeat = id;
  modalTitle.textContent = id;
  nameInput.value = reservations[id] || '';
  clearBtnEl.style.display = reservations[id] ? 'inline-block' : 'none';
  modalOverlay.style.display = 'flex';
  setTimeout(function() { nameInput.focus(); }, 100);
}

function doSave() {
  var sid = currentSeat;
  if (!sid) return;
  var v = nameInput.value.trim();
  if (v) {
    reservations[sid] = v;
  } else {
    delete reservations[sid];
  }
  saveState();
  modalOverlay.style.display = 'none';
  currentSeat = null;
  render();
}

function doCancel() {
  modalOverlay.style.display = 'none';
  currentSeat = null;
}

// Name popup for podium view - shows name in uppercase
function showNamePopup(id, name) {
  document.getElementById('namePopupText').textContent = name.toUpperCase();
  document.getElementById('namePopupSeatId').textContent = id;
  document.getElementById('namePopupOverlay').classList.add('open');
}

function closeNamePopup() {
  document.getElementById('namePopupOverlay').classList.remove('open');
}

function doClear() {
  if (currentSeat) {
    delete reservations[currentSeat];
    saveState();
    modalOverlay.style.display = 'none';
    currentSeat = null;
    render();
  }
}

function doReset() {
  var el = document.getElementById('resetConfirm');
  el.style.display = 'block';
}

function confirmReset() {
  reservations = {};
  hiddenRows = new Set();
  saveState();
  document.getElementById('resetConfirm').style.display = 'none';
  render();
  showToast('All cleared');
}

function cancelReset() {
  document.getElementById('resetConfirm').style.display = 'none';
}

var fitted = false;
document.getElementById('fitBtn').onclick = function() {
  fitted = !fitted;
  var board = document.getElementById('board');
  var w = floorEl.scrollWidth;
  if (fitted) {
    var scale = Math.min(1, (board.clientWidth - 32) / w);
    floorEl.style.transform = 'scale(' + scale + ')';
    floorEl.style.transformOrigin = 'top center';
    this.textContent = '100%';
  } else {
    floorEl.style.transform = '';
    this.textContent = 'Fit to screen';
  }
};

var toastTimer;
function showToast(m) {
  var t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 1600);
}

render();

// --- PWA install support ---

// 1) Register service worker (relative path so it works in any subfolder / HTTPS host)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('[PWA] Service worker registration failed:', err);
    });
  });
}

// 2) Capture the install prompt so we can show our own Install button reliably
var deferredPrompt = null;
var installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = '';
});
window.addEventListener('appinstalled', function () {
  if (installBtn) installBtn.style.display = 'none';
});

if (installBtn) {
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) {
      alert('Install prompt not available yet.\n\n• Stay on the page and interact for ~30s (Chrome requires engagement).\n• If you already dismissed it, Chrome hides it for a while.\n• Make sure you are in Chrome, not an in-app browser (WhatsApp/Instagram/etc.).\n\nManual install: Chrome menu (⋮) -> "Install app" / "Add to Home screen".');
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function () {
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  });
}
