const { useState, useEffect, useRef, useMemo } = React;

        // ====================================================================
        // PENTING: GANTI DENGAN KREDENSIAL CLOUDINARY ANDA
        // Anda bisa mendapatkan ini dari Dashboard Cloudinary Anda
        // Upload Preset bisa dibuat di Settings > Upload
        // ====================================================================
        const CLOUDINARY_CLOUD_NAME = 'dzx3qf4zy'; // Ganti dengan Cloud Name Anda
        const CLOUDINARY_UPLOAD_PRESET = 'Kasir_Aplikasi'; // Ganti dengan Upload Preset Anda

        const firebaseConfig = {
            apiKey: "AIzaSyDEDMpuIPFskJ-eUrRWJBu5qYbLmN734_U",
            authDomain: "aplikasikasir-c2ddc.firebaseapp.com",
            projectId: "aplikasikasir-c2ddc",
            storageBucket: "aplikasikasir-c2ddc.appspot.com",
            messagingSenderId: "456279209391",
            appId: "1:456279209391:web:7a1298f1e1b2368d462b5a",
            measurementId: "G-9CBTDVJ3ZN"
        };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();
        db.settings({ timestampsInSnapshots: true });

        const root = ReactDOM.createRoot(document.getElementById('root'));

        const App = () => {
            const [user, setUser] = useState({ isLoggedIn: false, uid: null, email: null, role: null, name: null });
            const [loginForm, setLoginForm] = useState({ email: '', password: '' });
            const [loginError, setLoginError] = useState(null);
            const [drawer, setDrawer] = useState(false);
            const [page, setPage] = useState('pos');
            const [adminTab, setAdminTab] = useState('dashboard');
            const [isLoading, setIsLoading] = useState(true);
            const [products, setProducts] = useState([]);
            const [salesHistory, setSalesHistory] = useState([]);
            const [cartItems, setCartItems] = useState([]);
            const [searchTerm, setSearchTerm] = useState('');
            const [selectedCategory, setSelectedCategory] = useState('Semua');
            const [paymentDialog, setPaymentDialog] = useState(false);
            const [cashReceived, setCashReceived] = useState(null);
            const [paymentMethod, setPaymentMethod] = useState('Tunai');
            const [isProcessingPayment, setIsProcessingPayment] = useState(false);
            const [snackbar, setSnackbar] = useState({ show: false, text: '', color: 'green-500' });
            const [productDialog, setProductDialog] = useState(false);
            const [editedProduct, setEditedProduct] = useState({ name: '', price: 0, category: '', image: '', stock: 0 });
            const [editedProductId, setEditedProductId] = useState(null);
            const salesChartRef = useRef(null);
            let salesChartInstance = useRef(null);
            const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));
            const [transactionToPrint, setTransactionToPrint] = useState(null);
            const [lastTransactionId, setLastTransactionId] = useState(null);
            const [selectedFile, setSelectedFile] = useState(null);
            const [isUploading, setIsUploading] = useState(false);
            const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

            const productHeaders = [
                { title: 'Nama Produk', key: 'name' },
                { title: 'Harga', key: 'price' },
                { title: 'Kategori', key: 'category' },
                { title: 'Stok', key: 'stock' },
                { title: 'Aksi', key: 'actions', sortable: false }
            ];
            const salesHeaders = [
                { title: 'Waktu', key: 'createdAt' },
                { title: 'Kasir', key: 'cashier.name' },
                { title: 'Total', key: 'total' },
                { title: 'Metode Bayar', key: 'paymentMethod' },
                { title: 'Jumlah Item', key: 'items.length' }
            ];

            useEffect(() => {
                const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
                    if (firebaseUser) {
                        const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
                        const userData = userDoc.exists ? userDoc.data() : { role: 'kasir' };
                        setUser({
                            isLoggedIn: true,
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            role: userData.role,
                            name: userData.name || firebaseUser.email.split('@')[0]
                        });
                        setPage(userData.role === 'admin' ? 'admin' : 'pos');
                        loadAppData();
                    } else {
                        setUser({ isLoggedIn: false, uid: null, email: null, role: null, name: null });
                        setIsLoading(false);
                    }
                });
                return () => unsubscribe();
            }, []);

            useEffect(() => {
                if (adminTab === 'dashboard' && salesChartRef.current) {
                    renderSalesChart();
                }
            }, [adminTab, salesHistory]);

            useEffect(() => {
                if (lastTransactionId) {
                    const latestTransaction = salesHistory.find(sale => sale.id === lastTransactionId);
                    if (latestTransaction && latestTransaction.createdAt) {
                        setTransactionToPrint(latestTransaction);
                        setLastTransactionId(null);
                    }
                }
            }, [salesHistory, lastTransactionId]);

            const loadAppData = () => {
                setIsLoading(true);
                db.collection('products').onSnapshot(snapshot => {
                    setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setIsLoading(false);
                });
                db.collection('sales').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
                    setSalesHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
            };

            const categories = useMemo(() => ['Semua', ...new Set(products.map(p => p.category))].filter(Boolean), [products]);
            const filteredProducts = useMemo(() => {
                let filtered = products;
                if (selectedCategory !== 'Semua') { filtered = filtered.filter(p => p.category === selectedCategory); }
                if (searchTerm) { filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())); }
                return filtered;
            }, [products, selectedCategory, searchTerm]);
            
            const cartSubtotal = useMemo(() => cartItems.reduce((total, item) => total + (item.price * item.quantity), 0), [cartItems]);
            const cartTax = useMemo(() => Math.round(cartSubtotal * 0.11), [cartSubtotal]);
            const cartTotal = useMemo(() => cartSubtotal + cartTax, [cartSubtotal, cartTax]);
            const changeAmount = useMemo(() => (cashReceived || 0) - cartTotal, [cashReceived, cartTotal]);
            const productFormTitle = useMemo(() => editedProductId ? 'Edit Produk' : 'Tambah Produk Baru', [editedProductId]);

            const todaysSales = useMemo(() => {
                const today = dayjs().format('YYYY-MM-DD');
                return salesHistory.filter(sale => sale.createdAt && dayjs(sale.createdAt.toDate()).format('YYYY-MM-DD') === today);
            }, [salesHistory]);
            const todaysRevenue = useMemo(() => todaysSales.reduce((sum, sale) => sum + sale.total, 0), [todaysSales]);
            const todaysTransactionCount = useMemo(() => todaysSales.length, [todaysSales]);
            const topSellingProducts = useMemo(() => {
                const productCount = {};
                todaysSales.forEach(sale => {
                    sale.items.forEach(item => {
                        productCount[`${item.name} - ${item.price}`] = (productCount[`${item.name} - ${item.price}`] || 0) + item.quantity;
                    });
                });
                return Object.entries(productCount).map(([name, sold]) => ({ name, sold })).sort((a, b) => b.sold - a.sold).slice(0, 5);
            }, [todaysSales]);
            const weeklySalesChartData = useMemo(() => {
                const labels = [];
                const data = [];
                for (let i = 6; i >= 0; i--) {
                    const date = dayjs().subtract(i, 'day');
                    labels.push(date.format('ddd'));
                    const dailySales = salesHistory.filter(sale => sale.createdAt && dayjs(sale.createdAt.toDate()).isSame(date, 'day'));
                    const dailyRevenue = dailySales.reduce((sum, sale) => sum + sale.total, 0);
                    data.push(dailyRevenue);
                }
                return { labels, data };
            }, [salesHistory]);

            const renderSalesChart = () => {
                if (salesChartInstance.current) { salesChartInstance.current.destroy(); }
                const ctx = salesChartRef.current?.getContext('2d');
                if (!ctx) return;
                salesChartInstance.current = new Chart(ctx, {
                    type: 'bar',
                    data: { labels: weeklySalesChartData.labels, datasets: [{ label: 'Pendapatan', data: weeklySalesChartData.data, backgroundColor: 'rgba(54, 162, 235, 0.6)' }] },
                    options: { responsive: true, scales: { y: { beginAtZero: true } } }
                });
            };

            const dailyReport = useMemo(() => {
                const salesOnDate = salesHistory.filter(sale => sale.createdAt && dayjs(sale.createdAt.toDate()).format('YYYY-MM-DD') === reportDate);
                const totalRevenue = salesOnDate.reduce((sum, sale) => sum + sale.total, 0);
                const paymentMethods = salesOnDate.reduce((acc, sale) => {
                    const method = sale.paymentMethod || 'Lainnya';
                    acc[`${method}`] = (acc[`${method}`] || 0) + sale.total;
                    return acc;
                }, {});
                return {
                    totalRevenue,
                    transactionCount: salesOnDate.length,
                    paymentMethods
                };
            }, [reportDate, salesHistory]);

            const addToCart = (product) => {
                const existingItem = cartItems.find(item => item.id === product.id);
                if (existingItem) {
                    if (existingItem.quantity < product.stock) {
                        setCartItems(cartItems.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
                    } else {
                        showSnackbar(`Stok ${product.name} tidak mencukupi!`, 'yellow-500');
                    }
                } else {
                    setCartItems([...cartItems, { ...product, quantity: 1 }]);
                }
            };
            const increaseQuantity = (item) => {
                const productInDb = products.find(p => p.id === item.id);
                if (item.quantity < productInDb.stock) {
                    setCartItems(cartItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
                } else {
                    showSnackbar(`Stok ${item.name} tidak mencukupi!`, 'yellow-500');
                }
            };
            const decreaseQuantity = (item) => {
                if (item.quantity > 1) {
                    setCartItems(cartItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                } else {
                    setCartItems(cartItems.filter(i => i.id !== item.id));
                }
            };
            const clearCart = () => setCartItems([]);
            const handlePayment = () => { setCashReceived(null); setPaymentMethod('Tunai'); setPaymentDialog(true); };
            const confirmPayment = async () => {
                if (isProcessingPayment) return;
                setIsProcessingPayment(true);

                const batch = db.batch();
                const saleRef = db.collection('sales').doc();
                
                let saleData = {
                    items: cartItems.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
                    subtotal: cartSubtotal, tax: cartTax, total: cartTotal,
                    paymentMethod,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    cashier: { email: user.email, uid: user.uid, name: user.name }
                };
                
                if (paymentMethod === 'Tunai') {
                    saleData = {
                        ...saleData,
                        cashReceived,
                        change: changeAmount
                    };
                }

                batch.set(saleRef, saleData);

                cartItems.forEach(item => {
                    const productRef = db.collection('products').doc(item.id);
                    batch.update(productRef, { stock: firebase.firestore.FieldValue.increment(-item.quantity) });
                });

                try {
                    await batch.commit();
                    showSnackbar("Transaksi berhasil disimpan!", "green-500");
                    setLastTransactionId(saleRef.id);
                    clearCart();
                    setPaymentDialog(false);
                } catch (error) {
                    console.error("Error saving sale: ", error);
                    showSnackbar("Gagal menyimpan transaksi!", "red-500");
                } finally {
                    setIsProcessingPayment(false);
                }
            };

            const showSnackbar = (text, color) => {
                setSnackbar({ show: true, text, color });
                setTimeout(() => setSnackbar({ show: false, text: '', color: '' }), 3000);
            };

            const handleLogin = async (e) => {
                e.preventDefault();
                setLoginError(null);
                try {
                    await auth.signInWithEmailAndPassword(loginForm.email, loginForm.password);
                } catch (error) {
                    setLoginError("Email atau password salah.");
                }
            };
            const handleLogout = async () => { await auth.signOut(); };

            const openProductDialog = (product = { name: '', price: 0, category: '', image: '', stock: 0 }) => {
                setEditedProduct(product);
                setEditedProductId(product.id || null);
                setSelectedFile(null);
                setImagePreviewUrl(product.image || null);
                setProductDialog(true);
            };

            const closeProductDialog = () => { 
                setProductDialog(false); 
                setSelectedFile(null);
                setImagePreviewUrl(null);
            };

            const uploadImageToCloudinary = async (file) => {
                setIsUploading(true);
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                try {
                    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                        method: 'POST',
                        body: formData,
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error.message || 'Gagal mengunggah gambar.');
                    }
                    return data.secure_url;
                } catch (error) {
                    console.error("Cloudinary upload error:", error);
                    showSnackbar("Gagal mengunggah gambar!", "red-500");
                    return null;
                } finally {
                    setIsUploading(false);
                }
            };

            const saveProduct = async () => {
                let imageUrl = editedProduct.image;
                if (selectedFile) {
                    showSnackbar("Mengunggah gambar...", "blue-500");
                    const newImageUrl = await uploadImageToCloudinary(selectedFile);
                    if (!newImageUrl) {
                        return;
                    }
                    imageUrl = newImageUrl;
                }

                const { id, ...productData } = editedProduct;
                const finalProductData = { ...productData, image: imageUrl };

                try {
                    if (editedProductId) {
                        await db.collection('products').doc(editedProductId).update(finalProductData);
                    } else {
                        await db.collection('products').add(finalProductData);
                    }
                    showSnackbar("Produk berhasil disimpan!", "green-500");
                    closeProductDialog();
                } catch (error) {
                    console.error("Error saving product:", error);
                    showSnackbar("Gagal menyimpan produk!", "red-500");
                }
            };
            
            const renderProductDialog = () => {
                if (!productDialog) return null;

                const handleFileChange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        setSelectedFile(file);
                        setImagePreviewUrl(URL.createObjectURL(file));
                    }
                };

                return (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center dialog-bg z-50">
                        <div className="relative p-6 bg-white rounded-lg shadow-xl w-full max-w-lg mx-auto transform transition-all">
                            <h3 className="text-xl font-bold mb-4">{productFormTitle}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nama Produk</label>
                                    <input type="text" value={editedProduct.name} onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Harga</label>
                                    <input type="number" value={editedProduct.price} onChange={(e) => setEditedProduct({ ...editedProduct, price: Number(e.target.value) })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Kategori</label>
                                    <input type="text" value={editedProduct.category} onChange={(e) => setEditedProduct({ ...editedProduct, category: e.target.value })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Stok</label>
                                    <input type="number" value={editedProduct.stock} onChange={(e) => setEditedProduct({ ...editedProduct, stock: Number(e.target.value) })}
                                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Gambar Produk</label>
                                    <input type="file" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                    {imagePreviewUrl && (
                                        <img src={imagePreviewUrl} alt="Pratinjau Gambar" className="mt-2 w-32 h-32 object-cover rounded-md border" />
                                    )}
                                    {!imagePreviewUrl && editedProduct.image && (
                                        <img src={editedProduct.image} alt="Gambar Produk Saat Ini" className="mt-2 w-32 h-32 object-cover rounded-md border" />
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                                <button onClick={closeProductDialog} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md">Batal</button>
                                <button onClick={saveProduct} disabled={isUploading} className={`font-bold py-2 px-4 rounded-md ${isUploading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                                    {isUploading ? 'Mengunggah...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            };

            const renderAdminContent = () => {
                switch (adminTab) {
                    case 'dashboard':
                        return (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                                        <h3 className="text-sm font-medium text-gray-500">Pendapatan Hari Ini</h3>
                                        <p className="text-2xl font-bold text-green-600">{formatCurrency(todaysRevenue)}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                                        <h3 className="text-sm font-medium text-gray-500">Transaksi Hari Ini</h3>
                                        <p className="text-2xl font-bold text-blue-600">{todaysTransactionCount}</p>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                                        <h3 className="text-sm font-medium text-gray-500">Total Produk</h3>
                                        <p className="text-2xl font-bold text-yellow-600">{products.length}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <h4 className="text-lg font-bold mb-4">Grafik Penjualan Mingguan</h4>
                                        <canvas ref={salesChartRef}></canvas>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg shadow-sm">
                                        <h4 className="text-lg font-bold mb-4">5 Produk Terlaris Hari Ini</h4>
                                        <ul className="divide-y divide-gray-200">
                                            {topSellingProducts.map((p, index) => (
                                                <li key={index} className="py-2 flex justify-between items-center">
                                                    <span className="font-medium text-gray-800">{p.name}</span>
                                                    <span className="text-sm text-gray-600">Terjual: {p.sold}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        );
                    case 'products':
                        return (
                            <div className="bg-white rounded-lg shadow-md p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold">Manajemen Produk</h2>
                                    <button onClick={() => openProductDialog()} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">
                                        Tambah Produk
                                    </button>
                                </div>
                                <Table headers={productHeaders} data={products} actions={[{
                                    title: 'Edit', onClick: (item) => openProductDialog(item),
                                    icon: (<i className="mdi mdi-pencil-box-outline text-xl text-blue-500 hover:text-blue-600 cursor-pointer"></i>)
                                }, {
                                    title: 'Hapus', onClick: (item) => deleteProduct(item.id),
                                    icon: (<i className="mdi mdi-trash-can-outline text-xl text-red-500 hover:text-red-600 cursor-pointer"></i>)
                                }]} />
                            </div>
                        );
                    case 'sales':
                        return (
                            <div className="bg-white rounded-lg shadow-md p-4">
                                <h2 className="text-xl font-bold mb-4">Riwayat Transaksi</h2>
                                <Table headers={salesHeaders} data={salesHistory} />
                            </div>
                        );
                    case 'daily_report':
                        return (
                            <div className="bg-white rounded-lg shadow-md p-4">
                                <h2 className="text-xl font-bold mb-4">Laporan Harian</h2>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700">Pilih Tanggal</label>
                                    <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
                                        className="mt-1 block w-full md:w-auto border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <p className="font-bold text-gray-700">Total Pendapatan:</p>
                                        <p className="text-xl font-semibold text-green-600">{formatCurrency(dailyReport.totalRevenue)}</p>
                                    </div>
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <p className="font-bold text-gray-700">Jumlah Transaksi:</p>
                                        <p className="text-xl font-semibold text-blue-600">{dailyReport.transactionCount}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <h4 className="text-lg font-bold mb-2">Penjualan Berdasarkan Metode Pembayaran:</h4>
                                    <ul className="space-y-1">
                                        {Object.entries(dailyReport.paymentMethods).map(([method, total]) => (
                                            <li key={method} className="flex justify-between font-medium">
                                                <span>{method}:</span>
                                                <span>{formatCurrency(total)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    default:
                        return <p>Pilih tab di menu admin.</p>;
                }
            };

            const deleteProduct = async (productId) => {
                if (window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
                    try {
                        await db.collection('products').doc(productId).delete();
                        showSnackbar("Produk berhasil dihapus!", "green-500");
                    } catch (error) {
                        console.error("Error deleting product:", error);
                        showSnackbar("Gagal menghapus produk!", "red-500");
                    }
                }
            };

            const formatCurrency = (amount) => {
                return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
            };

            const Table = ({ headers, data, actions }) => {
                if (!data || data.length === 0) {
                    return <p className="text-center text-gray-500">Tidak ada data untuk ditampilkan.</p>;
                }
                const getValue = (obj, key) => key.split('.').reduce((o, i) => o?.[i], obj);
                return (
                    <div className="overflow-x-auto rounded-lg shadow-md">
                        <table className="min-w-full bg-white">
                            <thead className="bg-gray-200">
                                <tr>
                                    {headers.map(header => (
                                        <th key={header.key} className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                                            {header.title}
                                        </th>
                                    ))}
                                    {actions && (
                                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                                            Aksi
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {data.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        {headers.map(header => (
                                            <td key={header.key} className="py-3 px-4 text-sm text-gray-800">
                                                {header.key === 'price' || header.key === 'total' || (header.key.includes('total') && header.key.split('.').length > 1) ? formatCurrency(getValue(item, header.key)) : getValue(item, header.key) instanceof firebase.firestore.Timestamp ? dayjs(getValue(item, header.key).toDate()).format('DD-MM-YYYY HH:mm') : getValue(item, header.key)}
                                            </td>
                                        ))}
                                        {actions && (
                                            <td className="py-3 px-4 flex items-center space-x-2">
                                                {actions.map((action, actionIndex) => (
                                                    <button key={actionIndex} onClick={() => action.onClick(item)} title={action.title}>
                                                        {action.icon}
                                                    </button>
                                                ))}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            };

            const closeReceipt = () => {
                setTransactionToPrint(null);
            };


            return (
                <div className="h-screen bg-gray-200">
                    {!user.isLoggedIn ? (
                        <div className="flex items-center justify-center h-screen">
                            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm">
                                <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Masuk</h2>
                                <form onSubmit={handleLogin}>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
                                        <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
                                        <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline" />
                                    </div>
                                    {loginError && <p className="text-red-500 text-xs italic mb-4">{loginError}</p>}
                                    <div className="flex items-center justify-between">
                                        <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full">
                                            Masuk
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-screen bg-gray-100">
                            {/* Drawer/Sidebar */}
                            <div className={`fixed inset-y-0 left-0 transform ${drawer ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-white shadow-xl z-40 flex flex-col`}>
                                <div className="p-4 border-b border-gray-200 text-center">
                                    <h1 className="text-2xl font-bold text-blue-600">Kasir Pro</h1>
                                </div>
                                <nav className="flex-grow p-4 space-y-2">
                                    {user.role === 'admin' && (
                                        <>
                                            {/* Tambahkan setDrawer(false) pada setiap onClick */}
                                            <button onClick={() => { setAdminTab('dashboard'); setPage('admin'); setDrawer(false); }} className={`w-full text-left py-2 px-4 rounded-md transition duration-200 ease-in-out ${page === 'admin' && adminTab === 'dashboard' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>Dashboard</button>
                                            <button onClick={() => { setAdminTab('products'); setPage('admin'); setDrawer(false); }} className={`w-full text-left py-2 px-4 rounded-md transition duration-200 ease-in-out ${page === 'admin' && adminTab === 'products' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>Manajemen Produk</button>
                                            <button onClick={() => { setAdminTab('sales'); setPage('admin'); setDrawer(false); }} className={`w-full text-left py-2 px-4 rounded-md transition duration-200 ease-in-out ${page === 'admin' && adminTab === 'sales' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>Riwayat Transaksi</button>
                                            <button onClick={() => { setAdminTab('daily_report'); setPage('admin'); setDrawer(false); }} className={`w-full text-left py-2 px-4 rounded-md transition duration-200 ease-in-out ${page === 'admin' && adminTab === 'daily_report' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>Laporan Harian</button>
                                        </>
                                    )}
                                    {/* Tambahkan setDrawer(false) pada onClick */}
                                    <button onClick={() => { setPage('pos'); setDrawer(false); }} className={`w-full text-left py-2 px-4 rounded-md transition duration-200 ease-in-out ${page === 'pos' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>Point of Sale</button>
                                </nav>
                                <div className="p-4 border-t border-gray-200">
                                    <div className="text-center text-sm text-gray-600 mb-2">
                                        <p>Selamat datang, <span className="font-bold">{user.name}</span></p>
                                        <p className="text-xs">({user.role === 'admin' ? 'Admin' : 'Kasir'})</p>
                                    </div>
                                    <button onClick={handleLogout} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition duration-200 ease-in-out">Keluar</button>
                                </div>
                            </div>
                            {/* Main Content */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <header className="bg-white shadow p-4 md:hidden flex justify-between items-center">
                                    <button onClick={() => setDrawer(!drawer)} className="text-gray-500 hover:text-gray-600 focus:outline-none">
                                        <i className="mdi mdi-menu text-2xl"></i>
                                    </button>
                                    <h2 className="text-xl font-bold text-gray-800">Kasir Pro</h2>
                                </header>
                                <main className="flex-1 p-4 overflow-y-auto">
                                    {page === 'pos' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                                            {/* Product Section */}
                                            <div className="md:col-span-2 bg-white rounded-lg shadow-md flex flex-col">
                                                <div className="p-4 border-b flex justify-between items-center">
                                                    <h2 className="text-xl font-bold">Pilih Produk</h2>
                                                    <div className="flex items-center gap-2">
                                                        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="p-2 border rounded-md">
                                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                        <input type="text" placeholder="Cari produk..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md" />
                                                    </div>
                                                </div>
                                                <div className="product-grid p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {isLoading ? (
                                                        <p className="col-span-4 text-center text-gray-500">Memuat produk...</p>
                                                    ) : filteredProducts.length > 0 ? (
                                                        filteredProducts.map(product => (
                                                            <div key={product.id} onClick={() => addToCart(product)} className={`product-card bg-gray-50 p-2 rounded-lg text-center shadow-sm ${product.stock <= 0 ? 'product-card-disabled' : ''}`}>
                                                                <img src={product.image || "https://placehold.co/100x100/E5E7EB/4B5563?text=Tidak+Ada+Gambar"} alt={product.name} className="w-full h-24 object-cover rounded-md mb-2" />
                                                                <p className="font-bold text-sm leading-tight">{product.name}</p>
                                                                <p className="text-blue-600 font-semibold">{formatCurrency(product.price)}</p>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="col-span-4 text-center text-gray-500">Tidak ada produk ditemukan.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Cart Section */}
                                            <div className="md:col-span-1 bg-white rounded-lg shadow-md cart-section">
                                                <div className="p-4 border-b flex justify-between items-center">
                                                    <h2 className="text-xl font-bold">Keranjang</h2>
                                                    <button onClick={clearCart} className="text-red-500 hover:text-red-700"><i className="mdi mdi-delete-sweep text-2xl"></i></button>
                                                </div>
                                                <div className="cart-items p-4 space-y-4">
                                                    {cartItems.length > 0 ? (
                                                        cartItems.map(item => (
                                                            <div key={item.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md shadow-sm">
                                                                <div className="flex-1">
                                                                    <p className="font-bold">{item.name}</p>
                                                                    <p className="text-sm text-gray-500">{formatCurrency(item.price)}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={() => decreaseQuantity(item)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-2 rounded-full">-</button>
                                                                    <span>{item.quantity}</span>
                                                                    <button onClick={() => increaseQuantity(item)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-2 rounded-full">+</button>
                                                                </div>
                                                                <p className="font-bold ml-4">{formatCurrency(item.price * item.quantity)}</p>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center text-gray-500">Keranjang kosong.</p>
                                                    )}
                                                </div>
                                                <div className="p-4 border-t space-y-2">
                                                    <div className="flex justify-between font-medium"><span>Subtotal:</span><span>{formatCurrency(cartSubtotal)}</span></div>
                                                    <div className="flex justify-between font-medium"><span>Pajak (11%):</span><span>{formatCurrency(cartTax)}</span></div>
                                                    <div className="flex justify-between font-bold text-lg"><span>Total:</span><span>{formatCurrency(cartTotal)}</span></div>
                                                    <button onClick={handlePayment} disabled={cartItems.length === 0} className={`w-full py-3 rounded-md font-bold transition-colors ${cartItems.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}>
                                                        Bayar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4">
                                            <h1 className="text-3xl font-bold mb-6">Halaman Admin</h1>
                                            {renderAdminContent()}
                                        </div>
                                    )}
                                </main>
                            </div>
                            {/* Payment Dialog */}
                            {paymentDialog && (
                                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center dialog-bg z-50">
                                    <div className="relative p-6 bg-white rounded-lg shadow-xl w-full max-w-sm mx-auto transform transition-all">
                                        <h3 className="text-xl font-bold text-center mb-4">Pembayaran</h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between text-lg font-bold"><span>Total:</span><span>{formatCurrency(cartTotal)}</span></div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
                                                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                                                    <option value="Tunai">Tunai</option>
                                                    <option value="Debit">Debit</option>
                                                    <option value="QRIS">QRIS</option>
                                                </select>
                                            </div>
                                            {paymentMethod === 'Tunai' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Uang Diterima</label>
                                                    <input type="number" value={cashReceived || ''} onChange={(e) => setCashReceived(Number(e.target.value))} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                                                    <div className="flex justify-between mt-2 font-medium text-red-500"><span>Kembalian:</span><span>{formatCurrency(changeAmount)}</span></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-6 flex justify-end gap-2">
                                            <button onClick={() => setPaymentDialog(false)} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md">Batal</button>
                                            <button onClick={confirmPayment} disabled={isProcessingPayment} className={`font-bold py-2 px-4 rounded-md ${isProcessingPayment ? 'bg-green-300 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
                                                {isProcessingPayment ? 'Memproses...' : 'Konfirmasi'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Product Dialog (Modifikasi) */}
                            {renderProductDialog()}

                            {/* Receipt to Print */}
                            {transactionToPrint && (
                                <div id="print-area" className="fixed inset-0 z-50 p-4 bg-white">
                                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-auto">
                                        <div className="text-center mb-4">
                                            <h4 className="text-xl font-bold">STRUK PENJUALAN</h4>
                                            <p className="text-sm">Kasir Pro - {dayjs(transactionToPrint.createdAt.toDate()).format('DD-MM-YYYY HH:mm')}</p>
                                        </div>
                                        <div className="border-t border-b border-dashed py-2 mb-4">
                                            {transactionToPrint.items.map((item, index) => (
                                                <div key={index} className="flex justify-between text-sm">
                                                    <span>{item.name} x{item.quantity}</span>
                                                    <span>{formatCurrency(item.price * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-1 text-sm font-medium mb-4">
                                            <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(transactionToPrint.subtotal)}</span></div>
                                            <div className="flex justify-between"><span>Pajak (11%):</span><span>{formatCurrency(transactionToPrint.tax)}</span></div>
                                            <div className="flex justify-between font-bold"><span>TOTAL:</span><span>{formatCurrency(transactionToPrint.total)}</span></div>
                                        </div>
                                        <div className="border-t border-b border-dashed py-2 mb-4 text-sm">
                                            {transactionToPrint.paymentMethod === 'Tunai' && (
                                                <>
                                                    <div className="flex justify-between"><span>Tunai:</span><span>{formatCurrency(transactionToPrint.cashReceived)}</span></div>
                                                    <div className="flex justify-between"><span>Kembalian:</span><span>{formatCurrency(transactionToPrint.change)}</span></div>
                                                </>
                                                    )}
                                                <p>Metode Pembayaran: {transactionToPrint.paymentMethod}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-end p-4 bg-gray-50 rounded-b-lg">
                                            <button onClick={closeReceipt} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md mr-2">Tutup</button>
                                            <button onClick={() => { window.print(); closeReceipt(); }} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Cetak</button>
                                        </div>
                                    </div>
                                )}
                            {/* Snackbar */}
                            {snackbar.show && (
                                <div className={`fixed bottom-4 right-4 bg-${snackbar.color} text-white p-4 rounded-lg shadow-lg`}>
                                    {snackbar.text}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        };

        root.render(<App />);
