// 1. LOAD DATA ON STARTUP
document.addEventListener('DOMContentLoaded', () => {
    fetchUserProfile(); // Loads the user name/image in Navbar
    loadFavourites();   // Loads the grid of cards
});


// --- RUN THIS ON LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    // ... your existing fetchUser / loadData calls ...
    
    highlightCurrentTab(); // <--- ADD THIS LINE
});

// --- FUNCTION TO HIGHLIGHT ACTIVE TAB ---
function highlightCurrentTab() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');

    // 1. Remove 'active' class from ALL links first
    navLinks.forEach(link => link.classList.remove('active'));

    // 2. Add 'active' class based on the URL
    if (currentPath.includes('favourites.html')) {
        // Find the Favourites link
        const favLink = document.querySelector('a[href*="favourites"]');
        if (favLink) favLink.classList.add('active');

    } else if (currentPath.includes('groups.html')) {
        // Find the Groups link
        const groupLink = document.querySelector('a[href*="groups"]');
        if (groupLink) groupLink.classList.add('active');

    } else {
        // Default to "Explore" (for /user or /user/index.html)
        const exploreLink = document.querySelector('a[href="/user"]');
        if (exploreLink) exploreLink.classList.add('active');
    }
}

// --- NAVBAR: GET USER NAME & IMAGE ---
async function fetchUserProfile() {
    try {
        const res = await fetch('/api/user/me'); 
        if (res.ok) {
            const user = await res.json();
            
            // Update Name
            const nameEl = document.getElementById('navUserName');
            if (nameEl) nameEl.textContent = user.name || "Traveler"; 

            // Update Image
            const imgEl = document.getElementById('navUserImg');
            if (imgEl && user.picture) {
                imgEl.src = user.picture;
            }
        }
    } catch (err) {
        console.error("Profile load failed:", err);
    }
}

// --- FAVOURITES LOGIC ---
async function loadFavourites() {
    const grid = document.getElementById('favGrid');
    
    try {
        const res = await fetch('/api/user/favourites');
        if (!res.ok) throw new Error('Failed to fetch favourites');

        const data = await res.json();
        renderGrid(data);

    } catch (err) {
        console.error("Error loading favourites:", err);
        if(grid) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#999; padding:60px;">
                                Could not load favourites. <br> Check your server connection.
                              </p>`;
        }
    }
}

function renderGrid(data) {
    const grid = document.getElementById('favGrid');
    if(!grid) return;

    if (!data || data.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:50px;">
                <h2 style="color:#ccc; margin-bottom:10px;">💔</h2>
                <h3 style="color:#555;">No favourites yet</h3>
                <p>Go back to <a href="/user" style="color:#ff5a5f; font-weight:600;">Explore</a> to save some trips!</p>
            </div>`;
        return;
    }

    grid.innerHTML = data.map(item => {
        const imgUrl = item.images || 'https://via.placeholder.com/400x300?text=Aroov+Trip';
        const destId = item.dest_id || item.id;
        
        // SAFE STRINGIFY: Escapes single quotes so titles like "John's Place" don't break the HTML
        const itemString = JSON.stringify(item).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        return `
        <div class="card" id="card-${destId}">
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
                    <button class="icon-btn" onclick="shareItem('${item.name}')">🔗</button>
                    
                    <button class="icon-btn heart-btn liked" 
                            title="Remove from Favourites"
                            onclick="removeFavourite(this, '${destId}')">
                        ❤️
                    </button>
                </div>
            </div>

            <button class="btn-details" onclick='openModal(${itemString})'>
                View Details
            </button>
        </div>
    `}).join('');
}

async function removeFavourite(btn, itemId) {
    if(!confirm("Remove this trip from your favourites?")) return;

    try {
        const res = await fetch(`/api/user/favourites/${itemId}`, { method: 'DELETE' });
        
        if (res.ok) {
            const card = document.getElementById(`card-${itemId}`);
            if(card) {
                // Animation for removal
                card.style.transition = "all 0.3s ease";
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                
                setTimeout(() => {
                    card.remove();
                    const grid = document.getElementById('favGrid');
                    // If grid is empty after removal, reload to show "No favourites" message
                    if(grid.querySelectorAll('.card').length === 0) {
                         loadFavourites(); 
                    }
                }, 300);
            }
        } else {
            alert("⚠️ Could not remove. Please try again.");
        }
    } catch (err) {
        console.error("Remove error:", err);
    }
}

// --- MODAL LOGIC ---
const modal = document.getElementById('detailModal');
const modalContent = document.getElementById('modalContentInject');

function openModal(item) {
    if(!modal || !modalContent) return;

    const imgUrl = item.images || 'https://via.placeholder.com/800x450';
    const destId = item.dest_id || item.id;
    // Create a google maps link
    const mapQuery = encodeURIComponent(`${item.name} ${item.state} Malaysia`);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    modalContent.innerHTML = `
        <div class="close-btn" onclick="closeModal()">×</div>
        <img src="${imgUrl}" class="modal-hero-img">
        
        <div class="modal-body">
            <div class="modal-flex">
                <div class="modal-main">
                    <h1 class="modal-title">${item.name}</h1>
                    <div class="modal-subtitle">
                        <span>📍 ${item.state}</span>
                        <span style="margin: 0 10px;">|</span>
                        <span>🏷️ Type: <strong>${item.type}</strong></span>
                    </div>
                    
                    <span class="modal-label">About</span>
                    <p class="modal-desc">${item.description || "No description available."}</p>
                    
                    <span class="modal-label">Activities</span>
                    <p style="color:#555; line-height: 1.6;">
                        ${item.activities || "Sightseeing, Photography, Relaxation"}
                    </p>
                </div>

                <div class="modal-sidebar">
                    <span class="modal-label">Est Cost</span>
                    <span class="modal-price-tag">RM${item.price_min} - RM${item.price_max}</span>
                    
                    <a href="${mapUrl}" target="_blank" style="text-decoration:none;">
                        <button class="btn-map">
                            🗺️ View on Google Maps
                        </button>
                    </a>

                    <button class="btn-modal-add heart-btn liked" 
                            style="margin-top:10px; background: white; color: red; border: 2px solid #eee;"
                            onclick="removeFavourite(this, '${destId}'); closeModal();">
                        💔 Remove Favourite
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

function closeModal() { 
    if(modal) modal.style.display = 'none'; 
}

// Close modal when clicking outside
window.onclick = function(e) { 
    if (e.target == modal) closeModal(); 
}

function shareItem(name) { 
    // Copies the current URL to clipboard (or you could generate a specific link)
    navigator.clipboard.writeText(window.location.href); 
    alert(`Link for ${name} copied to clipboard!`); 
}

// --- MOBILE MENU TOGGLE ---
const menuBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.getElementById('nav-links-container');

if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        
        // Animate hamburger bars
        const bars = document.querySelectorAll('.bar');
        if(bars.length === 3) {
            if (navLinks.classList.contains('active')) {
                bars[0].style.transform = 'translateY(8px) rotate(45deg)';
                bars[1].style.opacity = '0';
                bars[2].style.transform = 'translateY(-8px) rotate(-45deg)';
            } else {
                bars[0].style.transform = 'none';
                bars[1].style.opacity = '1';
                bars[2].style.transform = 'none';
            }
        }
    });
}