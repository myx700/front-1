// مسار السيرفر (غيخدم دابا حيت كلشي فـ localhost:3000)
const API_URL = '/api/reports'; 
const OUJDA_COORDS = [34.6894, -1.9105];

let mainMap, pickerMap, pickerMarker;
let selectedLocation = null;
let allReports = [];
let mapMarkers = []; // باش نمسحو العلامات القديمة ملي نحدثو الخريطة

// 1. تهيئة الخريطة الرئيسية
function initMap() {
    mainMap = L.map('main-map').setView(OUJDA_COORDS, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap - Baladi Oujda'
    }).addTo(mainMap);
}

// 2. تهيئة خريطة اختيار المكان (نافذة إضافة بلاغ)
function initPickerMap() {
    if(pickerMap) {
        pickerMap.invalidateSize(); // إصلاح مشكلة ظهور الخريطة رمادية
        return; 
    }
    pickerMap = L.map('picker-map').setView(OUJDA_COORDS, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(pickerMap);
    
    pickerMap.on('click', function(e) {
        if(pickerMarker) pickerMap.removeLayer(pickerMarker);
        pickerMarker = L.marker(e.latlng).addTo(pickerMap);
        selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
    });
}

// 3. زر الـ GPS لتحديد الموقع تلقائياً
document.getElementById('locate-me-btn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert("المتصفح ديالك ما كيدعمش الـ GPS.");

    const btn = document.getElementById('locate-me-btn');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            pickerMap.setView([lat, lng], 16);
            if(pickerMarker) pickerMap.removeLayer(pickerMarker);
            pickerMarker = L.marker([lat, lng]).addTo(pickerMap);
            selectedLocation = { lat: lat, lng: lng };
            
            btn.innerHTML = '<i class="fa-solid fa-check" style="color: green;"></i> تم تحديد موقعك';
            setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 3000);
        },
        (error) => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            alert("ما قدرناش نحددو البلاصة ديالك. تأكد بلي عاطي الصلاحية للـ GPS.");
        },
        { enableHighAccuracy: true }
    );
});

// 4. جلب البلاغات من الخادم
async function fetchReports() {
    try {
        const res = await fetch(API_URL);
        allReports = await res.json();
        renderReports();
        updateStats();
        addMarkersToMap();
    } catch (err) {
        document.getElementById('reports-list').innerHTML = '<p style="color:red; text-align:center;">تعذر الاتصال بالخادم. تأكد من تشغيل الـ Backend.</p>';
    }
}

// 5. عرض البلاغات في القائمة
function renderReports() {
    const container = document.getElementById('reports-list');
    container.innerHTML = '';
    
    if(allReports.length === 0) {
        container.innerHTML = '<p style="text-align:center;">لا توجد بلاغات حالياً. مدينتنا نقية!</p>';
        return;
    }

    allReports.forEach(report => {
        let statusText = report.status === 'pending' ? 'في الانتظار' : (report.status === 'in-progress' ? 'جاري الإصلاح' : 'تم الحل');
        let date = new Date(report.createdAt).toLocaleDateString('ar-MA');
        
        container.innerHTML += `
            <div class="report-card">
                <div class="report-header">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> ${report.category}</strong>
                    <span class="badge ${report.status}">${statusText}</span>
                </div>
                <p>${report.description || 'بدون وصف إضافي'}</p>
                <small style="color: #777; margin-top: 10px; display: block;"><i class="fa-regular fa-clock"></i> ${date}</small>
                <div class="report-actions">
                    <button class="btn-action whatsapp" onclick="shareWhatsApp('${report.category}')">
                        <i class="fa-brands fa-whatsapp"></i> شارك مع واتساب
                    </button>
                </div>
            </div>
        `;
    });
}

// 6. إضافة العلامات للخريطة الرئيسية
function addMarkersToMap() {
    // حذف العلامات القديمة لتفادي التكرار عند التحديث
    mapMarkers.forEach(marker => mainMap.removeLayer(marker));
    mapMarkers = [];

    allReports.forEach(report => {
        if(report.location && report.location.lat && report.location.lng) {
            let statusText = report.status === 'solved' ? '✅ تم الحل' : '⏳ جاري/انتظار';
            let marker = L.marker([report.location.lat, report.location.lng]).addTo(mainMap);
            marker.bindPopup(`<b style="color:var(--blue);">${report.category}</b><br>الحالة: ${statusText}`);
            mapMarkers.push(marker);
        }
    });
}

// 7. تحديث الإحصائيات الفوق
function updateStats() {
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = allReports.length;
    if(document.getElementById('stat-active')) document.getElementById('stat-active').innerText = allReports.filter(r => r.status !== 'solved').length;
    if(document.getElementById('stat-solved')) document.getElementById('stat-solved').innerText = allReports.filter(r => r.status === 'solved').length;
}

// 8. إرسال بلاغ جديد
document.getElementById('add-report-form').onsubmit = async (e) => {
    e.preventDefault();
    if(!selectedLocation) return alert("عافاك حدد البلاصة فالخريطة أولاً!");
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.innerText = "جاري الإرسال...";
    submitBtn.disabled = true;

    const reportData = {
        category: document.getElementById('report-category').value,
        description: document.getElementById('report-desc').value,
        location: selectedLocation
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        
        alert("شكراً بزاف! بلاغك وصل للجماعة الحضرية.");
        document.getElementById('add-modal').style.display = "none";
        document.getElementById('add-report-form').reset();
        selectedLocation = null;
        if(pickerMarker) pickerMap.removeLayer(pickerMarker);
        
        fetchReports(); // تحديث القائمة والخريطة
    } catch (err) {
        alert("وقع مشكل فالاتصال، عاود جرب.");
    } finally {
        submitBtn.innerText = "إرسال البلاغ";
        submitBtn.disabled = false;
    }
};

// 9. التحكم في النوافذ المنبثقة والواتساب
const modal = document.getElementById('add-modal');
document.getElementById('fab-add').onclick = () => {
    modal.style.display = "block";
    setTimeout(initPickerMap, 300); // تأخير بسيط لضمان تحميل الـ Div
};
document.querySelector('.close-modal').onclick = () => modal.style.display = "none";

// إغلاق النافذة إذا ضغط المستخدم خارجها
window.onclick = (e) => {
    if (e.target == modal) modal.style.display = "none";
};

window.shareWhatsApp = function(category) {
    const text = `عافاك شوف هاد البلاغ فمنصة بلدي وجدة: مشكل "${category}". نتعاونو باش نصلحو مدينتنا!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

// 10. التشغيل عند فتح الصفحة
window.onload = () => {
    initMap();
    fetchReports();
};