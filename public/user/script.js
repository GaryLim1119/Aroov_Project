// /public/user/script.js

let currentPage = 1;
let currentItemToShare = null; 

// --- 1. LOAD DESTINATIONS ---
async function loadDestinations() {
    const search = document.getElementById('searchInput').value;
    const type = document.getElementById('typeFilter').value;
    const maxPrice = document.getElementById('priceFilter').value;

    let url = `/api/destinations?page=${currentPage}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    if (maxPrice) url += `&maxPrice=${maxPrice}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch destinations");
        
        const { data, totalPages } = await res.json();
        renderGrid(data);
        renderPagination(totalPages);
    } catch (err) {
        console.error("Error loading destinations:", err);
        document.getElementById('destGrid').innerHTML = `<p style="text-align:center; padding:40px; color:red;">Failed to load data.</p>`;
    }
}

// --- 2. RENDER GRID (FIXED QUOTE ISSUE) ---
function renderGrid(data) {
    const grid = document.getElementById('destGrid');
    
    if (!data || data.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#999; padding:40px;">No results found.</p>`;
        return;
    }

    grid.innerHTML = data.map(item => {
        const imgUrl = item.images || 'https://via.placeholder.com/400x300?text=Aroov+Trip';
        const heartClass = item.is_liked ? 'liked' : ''; 
        
        // ✅ CRITICAL FIX: Escape quotes so HTML doesn't break
        const safeItem = JSON.stringify(item).replace(/"/g, '&quot;');

        return `
        <div class="card">
            <div class="card-image-wrapper">
                <img src="${imgUrl}" class="card-img" alt="${item.name}">
                <div class="card-overlay">
                    <div class="card-title">${item.name}</div>
                    <div class="card-location"><span>📍 ${item.state} • ${item.type}</span></div>
                </div>
            </div>
            
            <div class="card-bottom">
                <div class="card-price">
                    <span class="price-label">Estimated Price</span>
                    <span class="price-value">RM${item.price_min} - ${item.price_max}</span>
                </div>
                <div class="card-icons">
                    <button class="icon-btn" onclick="openShareModal(${safeItem})">🔗</button>
                    <button class="icon-btn heart-btn ${heartClass}" onclick="toggleFavourite(this, '${item.dest_id}')">❤️</button>
                </div>
            </div>

            <button class="btn-details" onclick="openModal(${safeItem})">
                View Details
            </button>
        </div>
    `}).join('');
}

// --- 3. SHARE MODAL FUNCTIONS ---
function openShareModal(item) {
    currentItemToShare = item; 
    const modal = document.getElementById('shareModal');
    if(modal) {
        modal.classList.add('active'); 
        fetchUserGroupsForShare(); 
    }
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('active');
}

function actionCopyLink() {
    if(!currentItemToShare) return;
    const shareUrl = `${window.location.origin}/destination?id=${currentItemToShare.dest_id}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        const btn = document.querySelector('.btn-share-action');
        if(btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = "✅ Copied!";
            setTimeout(() => btn.innerHTML = originalText, 2000);
        }
    });
}

function actionEmailShare() {
    if(!currentItemToShare) return;
    const subject = `Trip Recommendation: ${currentItemToShare.name}`;
    const body = `Hey,\n\nI found this amazing place on Aroov Trip!\n\nDestination: ${currentItemToShare.name}\nState: ${currentItemToShare.state}\nEst. Cost: RM${currentItemToShare.price_min} - RM${currentItemToShare.price_max}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// --- 4. FETCH GROUPS FOR SHARE MODAL ---
async function fetchUserGroupsForShare() {
    const listContainer = document.getElementById('shareGroupList');
    listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#ccc;">Syncing...</div>';

    try {
        const res = await fetch('/api/user/groups'); 
        if (res.status === 401) return; // User not logged in

        const groups = await res.json();

        if (groups.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px; text-align:center; font-size:13px;">No groups found.<br><a href="/user/groups.html" style="color:blue;">Create one here</a></div>';
            return;
        }

        listContainer.innerHTML = groups.map(g => `
            <div class="share-group-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                <div class="share-group-info">
                    <h4 style="margin:0;">${g.group_name}</h4>
                    <span style="font-size:12px; color:#777;">${g.member_count} Members</span>
                </div>
                <button class="btn-add-group" style="padding:5px 10px; cursor:pointer;" onclick="addToGroup(${g.group_id}, this)">
                    Add +
                </button>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Error loading groups.</div>';
    }
}

// --- 5. ADD TO GROUP ---
async function addToGroup(groupId, btnElement) {
    if(!currentItemToShare) return;
    
    const originalText = btnElement.innerText;
    btnElement.innerText = "...";
    btnElement.disabled = true;

    try {
        const res = await fetch(`/api/groups/${groupId}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination_id: currentItemToShare.dest_id })
        });

        const data = await res.json();

        if (!res.ok) {
            alert("⚠️ " + (data.error || "Failed to add"));
            btnElement.innerText = originalText;
            btnElement.disabled = false;
        } else {
            btnElement.innerText = "Added ✅";
            btnElement.style.background = "#2ecc71"; 
            btnElement.style.color = "white";
        }
    } catch (err) {
        alert("Network error");
        btnElement.innerText = originalText;
        btnElement.disabled = false;
    }
}

// --- 6. FAVOURITES ---
async function toggleFavourite(btn, itemId) {
    const isLiked = btn.classList.contains('liked');
    btn.classList.toggle('liked'); 

    try {
        const method = isLiked ? 'DELETE' : 'POST';
        const url = isLiked ? `/api/user/favourites/${itemId}` : `/api/user/favourites`;
        const body = isLiked ? null : JSON.stringify({ destinationId: itemId });

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        if (!res.ok) throw new Error("API Failed");
    } catch (err) {
        btn.classList.toggle('liked'); 
        console.error(err);
    }
}

// --- 7. DETAILS MODAL ---
const detailModal = document.getElementById('detailModal');
const modalContent = document.getElementById('modalContentInject');

function openModal(item) {
    const imgUrl = item.images || 'https://via.placeholder.com/800x450';
    const safeItem = JSON.stringify(item).replace(/"/g, '&quot;');
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.state)}`;

    modalContent.innerHTML = `
        <div class="close-btn" onclick="closeDetailModal()" style="position:absolute; right:20px; top:20px; cursor:pointer; font-size:24px; color:white; background:rgba(0,0,0,0.5); width:40px; height:40px; border-radius:50%; text-align:center; line-height:40px;">×</div>
        <img src="${imgUrl}" class="modal-hero-img" style="width:100%; height:300px; object-fit:cover;">
        <div class="modal-body" style="padding:20px;">
            <h1 class="modal-title">${item.name}</h1>
            <div class="modal-subtitle">📍 ${item.state} | 🏷️ ${item.type}</div>
            <p class="modal-desc" style="margin-top:15px;">${item.description || "No description available."}</p>
            
            <div style="margin-top:20px;">
                <a href="${mapUrl}" target="_blank"><button class="btn-map" style="width:100%; padding:10px;">🗺️ View on Maps</button></a>
                <button class="btn-modal-add" style="width:100%; padding:10px; margin-top:10px; background:#555; color:white;" onclick="closeDetailModal(); openShareModal(${safeItem})">🔗 Share</button>
            </div>
        </div>
    `;
    detailModal.style.display = 'flex';
}

function closeDetailModal() { detailModal.style.display = 'none'; }

// Close modals on outside click
window.onclick = function(e) { 
    if (e.target == detailModal) closeDetailModal(); 
    if (e.target == document.getElementById('shareModal')) closeShareModal();
}

// Pagination
function renderPagination(total) {
    const nav = document.getElementById('pagination');
    nav.innerHTML = '';
    for(let i=1; i<=total; i++) {
        nav.innerHTML += `<button class="page-btn ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
    }
}
function changePage(p) { currentPage = p; loadDestinations(); }
function applyFilters() { currentPage = 1; loadDestinations(); }

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
    loadDestinations();
});