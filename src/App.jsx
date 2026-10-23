import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Lock, Unlock, Crown, Search, Film, Settings,
  Plus, Trash2, Shield, ArrowLeft, Pencil, LogOut, UserRound, Heart, Info, Clock3
} from 'lucide-react';
import { loadAppState, saveAppState } from './persistedState.js';

// Sample Initial Movies Data
const initialMovies = [
  {
    id: 1,
    title: "សង្គ្រាមអាណាចក្រ AI",
    titleEn: "AI Empire War",
    category: "Sci-Fi / Action",
    isPaid: true,
    price: "$1.99",
    duration: "1h 45m",
    rating: "4.8",
    views: "12.5K",
    cover: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    description: "រឿងភាគនិពន្ធដោយ AI រៀបរាប់អំពីពិភពអនាគតដែលមនុស្ស និង AI ត្រូវប្រយុទ្ធគ្នាដើម្បីរស់។"
  },
  {
    id: 2,
    title: "ព្រលឹងប្រាសាទបុរាណ",
    titleEn: "Ancient Temple Spirit",
    category: "Horror / Fantasy",
    isPaid: false,
    price: "FREE",
    duration: "45m",
    rating: "4.5",
    views: "28.1K",
    cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    description: "រឿងរ៉ាវអាថ៌កំបាំងក្នុងប្រាសាទបុរាណ Khmer AI បង្កើតឡើងយ៉ាងរន្ធត់ និងទាក់ទាញ។"
  },
  {
    id: 3,
    title: "ស្នេហាឆ្លងកាលវេលា",
    titleEn: "Love Across Time",
    category: "Romance / Drama",
    isPaid: false,
    price: "FREE",
    duration: "1h 20m",
    rating: "4.9",
    views: "45.0K",
    cover: "https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    description: "រឿងភាគស្នេហាយ៉ាងផ្អែមល្ហែមដែលផលិតឡើងដោយសំឡេង និងរូបភាព AI ភាសាខ្មែរ ១០០%។"
  },
  {
    id: 4,
    title: "វីរបុរសស្រមោល AI",
    titleEn: "Shadow Hero AI",
    category: "Action / Hero",
    isPaid: true,
    price: "$2.50",
    duration: "2h 05m",
    rating: "4.7",
    views: "8.9K",
    cover: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    description: "ការផ្សងព្រេងរបស់វីរបុរសជំនាន់ថ្មីដើម្បីការពារក្រុងភ្នំពេញក្នុងឆ្នាំ ២០៥០។"
  }
];

export default function App() {
  const [movies, setMovies] = useState(initialMovies);
  const [activeTab, setActiveTab] = useState('home'); // home, admin, watch
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [filter, setFilter] = useState('all'); // all, free, paid
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [watchProgress, setWatchProgress] = useState([]);
  const hasAuthenticatedAccount = useRef(false);
  const [detailsMovie, setDetailsMovie] = useState(null);
  const [watchError, setWatchError] = useState('');
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [checkoutAfterAuth, setCheckoutAfterAuth] = useState(false);
  
  // User Access State
  const [isVipUser, setIsVipUser] = useState(false);
  const [unlockedMovieIds, setUnlockedMovieIds] = useState([]);
  
  // Modal & Payment States
  const [showPayModal, setShowPayModal] = useState(false);
  const [pendingMovie, setPendingMovie] = useState(null);
  const [payStep, setPayStep] = useState(1); // 1: customer details, 2: payment pending, 3: approved
  const [telegramNoticeError, setTelegramNoticeError] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
  const [customerAccessMessage, setCustomerAccessMessage] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [paymentOrders, setPaymentOrders] = useState([]);
  const [adminOrderError, setAdminOrderError] = useState('');
  const [analytics, setAnalytics] = useState(null);

  // Admin New Movie Form
  const [newMovie, setNewMovie] = useState({
    title: '', category: 'Action', isPaid: false, price: '$1.00', duration: '1h 00m', cover: '', videoUrl: '', description: ''
  });
  const [editingMovieId, setEditingMovieId] = useState(null);

  const refreshAccount = async () => {
    const response = await fetch('/api/auth/me');
    if (!response.ok) throw new Error('Could not load account');
    const account = await response.json();
    hasAuthenticatedAccount.current = Boolean(account.user);
    setCurrentUser(account.user);
    setIsVipUser(Boolean(account.access?.vip));
    setUnlockedMovieIds(Array.isArray(account.access?.movieIds) ? account.access.movieIds : []);
    setPaymentOrder(account.latestOrder || null);
    const profile = {
      favorites: Array.isArray(account.profile?.favorites) ? account.profile.favorites : [],
      progress: Array.isArray(account.profile?.progress) ? account.profile.progress : [],
    };
    if (account.user) {
      setFavorites(profile.favorites);
      setWatchProgress(profile.progress);
    }
    if (account.user) setActiveTab('customer');
    setIsAuthReady(true);
    return account;
  };

  useEffect(() => {
    let isCurrent = true;
    fetch('/api/auth/me').then(async (response) => {
      if (!response.ok) throw new Error('Could not load account');
      return response.json();
    }).then((account) => {
      if (!isCurrent) return;
      hasAuthenticatedAccount.current = Boolean(account.user);
      setCurrentUser(account.user);
      setIsVipUser(Boolean(account.access?.vip));
      setUnlockedMovieIds(Array.isArray(account.access?.movieIds) ? account.access.movieIds : []);
      setPaymentOrder(account.latestOrder || null);
      const profile = {
        favorites: Array.isArray(account.profile?.favorites) ? account.profile.favorites : [],
        progress: Array.isArray(account.profile?.progress) ? account.profile.progress : [],
      };
      if (account.user) {
        setFavorites(profile.favorites);
        setWatchProgress(profile.progress);
      }
      if (account.user) setActiveTab('customer');
      setIsAuthReady(true);
    }).catch(() => {
      if (isCurrent) setIsAuthReady(true);
    });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleSuccess = params.get('google_success');
    const googleError = params.get('google_error');
    const verifyToken = params.get('verify');
    const passwordToken = params.get('reset');
    const loginToken = params.get('login');
    if (googleSuccess) {
      window.history.replaceState({}, '', window.location.pathname);
      refreshAccount().then((account) => { if (account.user) setActiveTab('customer'); }).catch(() => undefined);
    } else if (googleError) {
      setShowAuthModal(true);
      setAuthMode('login');
      setAuthError(googleError === 'account_conflict'
        ? 'This Google account conflicts with an existing linked account. Contact support.'
        : googleError === 'not_configured'
          ? 'Google login is not configured. Replace the sample Client ID and Secret in .env with real Google OAuth credentials.'
          : 'Google sign-in did not complete. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (verifyToken) {
      setShowAuthModal(true);
      setAuthMode('verify');
      fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: verifyToken }) })
        .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); setAuthNotice('Email verified. You can now sign in.'); setAuthMode('login'); })
        .catch((error) => { setAuthMode('login'); setAuthError(error.message || 'Verification failed.'); })
        .finally(() => { window.history.replaceState({}, '', window.location.pathname); });
    } else if (passwordToken) {
      setResetToken(passwordToken);
      setAuthMode('reset');
      setShowAuthModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (loginToken) {
      setShowAuthModal(true);
      setAuthMode('verifyLogin');
      fetch('/api/auth/email-login/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: loginToken }) })
        .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); await refreshAccount(); setActiveTab('customer'); setAuthNotice('You are signed in.'); setShowAuthModal(false); })
        .catch((error) => { setAuthMode('login'); setAuthError(error.message || 'Sign-in failed.'); })
        .finally(() => { window.history.replaceState({}, '', window.location.pathname); });
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    loadAppState().then((savedState) => {
      if (!isCurrent) return;

      if (savedState && Array.isArray(savedState.movies)) {
        setMovies(savedState.movies.map((movie) => ({
          ...movie,
          cover: movie.coverBlob ? URL.createObjectURL(movie.coverBlob) : movie.cover,
          videoUrl: movie.videoBlob ? URL.createObjectURL(movie.videoBlob) : movie.videoUrl,
        })));
        if (!hasAuthenticatedAccount.current) {
          setFavorites(Array.isArray(savedState.favorites) ? savedState.favorites : []);
          setWatchProgress(Array.isArray(savedState.watchProgress) ? savedState.watchProgress : []);
        }
      }

      setIsStorageReady(true);
    }).catch((error) => {
      if (!isCurrent) return;
      setStorageError(error instanceof Error ? error.message : String(error));
      setIsStorageReady(true);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!isStorageReady || storageError) return;

    saveAppState({ movies, isVipUser, unlockedMovieIds, paymentOrder, favorites, watchProgress }).catch((error) => {
      setStorageError(error instanceof Error ? error.message : String(error));
    });
  }, [isStorageReady, storageError, movies, isVipUser, unlockedMovieIds, paymentOrder, favorites, watchProgress]);

  useEffect(() => {
    if (!currentUser || !isAuthReady) return;

    const timeout = window.setTimeout(() => {
      fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorites, progress: watchProgress }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not sync your profile');
      }).catch((error) => {
        setWatchError(error instanceof Error ? error.message : 'Could not sync your profile');
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [currentUser, isAuthReady, favorites, watchProgress]);

  if ((!isStorageReady || !isAuthReady) && !storageError) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center" role="status">
        កំពុងផ្ទុកទិន្នន័យដែលបានរក្សាទុក...
      </div>
    );
  }

  // Handle Local File Uploads from PC
  const handleCoverFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewMovie((current) => ({
        ...current,
        cover: URL.createObjectURL(file),
        coverBlob: file,
      }));
    }
  };

  const handleVideoFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewMovie((current) => ({
        ...current,
        videoUrl: URL.createObjectURL(file),
        videoBlob: file,
      }));
    }
  };

  // Filter Logic
  const movieCategories = [...new Set(
    movies.flatMap((movie) => (movie.category || '').split(/[,\u002f]/).map((category) => category.trim()).filter(Boolean))
  )].sort((first, second) => first.localeCompare(second));
  const filteredMovies = movies.filter(m => {
    const matchesFilter = filter === 'all' ? true
      : filter === 'free' ? !m.isPaid
        : filter === 'paid' ? m.isPaid
          : favorites.includes(m.id);
    const matchesCategory = categoryFilter === 'all' || (m.category || '')
      .split(/[,\u002f]/)
      .some((category) => category.trim().toLowerCase() === categoryFilter.toLowerCase());
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.titleEn || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesCategory && matchesSearch;
  });

  const toggleFavorite = (movieId) => {
    setFavorites((current) => current.includes(movieId)
      ? current.filter((id) => id !== movieId)
      : [...current, movieId]);
  };

  const updateWatchProgress = (movieId, currentTime, duration) => {
    if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return;
    const progress = {
      movieId,
      currentTime: Math.min(currentTime, duration),
      duration,
      updatedAt: new Date().toISOString(),
    };
    setWatchProgress((current) => [progress, ...current.filter((item) => item.movieId !== movieId)].slice(0, 100));
  };

  const clearWatchProgress = (movieId) => {
    setWatchProgress((current) => current.filter((item) => item.movieId !== movieId));
  };

  // Click Play Handler
  const handlePlayMovie = (movie) => {
    const hasAccess = !movie.isPaid || (currentUser && (isVipUser || unlockedMovieIds.includes(movie.id)));
    if (hasAccess) {
      setSelectedMovie(movie);
      setDetailsMovie(null);
      setWatchError('');
      setActiveTab('watch');
      if (currentUser) {
        fetch('/api/analytics/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movieId: movie.id }),
        }).then((response) => {
          if (!response.ok) throw new Error('Could not record this view.');
        }).catch((error) => {
          setWatchError(error instanceof Error ? error.message : 'Could not record this view.');
        });
      }
    } else if (!currentUser) {
      setPendingMovie(movie);
      setCheckoutAfterAuth(true);
      setAuthMode('login');
      setAuthError('');
      setShowAuthModal(true);
    } else {
      setPendingMovie(movie);
      setPayStep(1);
      setShowPayModal(true);
    }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setIsSubmittingAuth(true);
    try {
      if (['forgot', 'reset', 'magic'].includes(authMode)) {
        const endpoint = authMode === 'forgot' ? '/api/auth/forgot-password' : authMode === 'reset' ? '/api/auth/reset-password' : '/api/auth/email-login';
        const payload = authMode === 'forgot' || authMode === 'magic' ? { email: authEmail } : { token: resetToken, password: authPassword };
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Request could not be completed');
        if (authMode === 'forgot' || authMode === 'magic') setAuthNotice(result.message);
        else {
          setAuthNotice('Password updated. Sign in with your new password.');
          setAuthMode('login');
          setAuthPassword('');
          setResetToken('');
        }
        return;
      }
      const response = await fetch(`/api/auth/${authMode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not sign in');
      if (result.needsVerification) {
        setAuthNotice('Check your email and open the verification link before signing in.');
        setAuthMode('login');
        return;
      }
      await refreshAccount();
      setShowAuthModal(false);
      setAuthPassword('');
      if (checkoutAfterAuth) {
        setCheckoutAfterAuth(false);
        setPayStep(1);
        setShowPayModal(true);
      } else setActiveTab('customer');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const resendVerification = async () => {
    setAuthError('');
    setAuthNotice('');
    try {
      const response = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send a verification email');
      setAuthNotice(result.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not send a verification email');
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    hasAuthenticatedAccount.current = false;
    setCurrentUser(null);
    setIsVipUser(false);
    setUnlockedMovieIds([]);
    setFavorites([]);
    setWatchProgress([]);
    setPaymentOrder(null);
    setAdminPassword('');
    setIsAdminAuthenticated(false);
    setPaymentOrders([]);
    setShowPayModal(false);
  };

  // Create a pending order and notify the owner to verify the ABA deposit.
  const confirmPayment = async () => {
    setTelegramNoticeError('');
    setPaymentStatusMessage('');
    setIsCreatingOrder(true);
    try {
      const response = await fetch('/api/payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: pendingMovie ? pendingMovie.title : 'VIP Monthly Pass',
          amount: pendingMovie ? pendingMovie.price : '$4.99',
          movieId: pendingMovie?.id ?? null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create order');
      setPaymentOrder(result);
      setPaymentStatusMessage(result.notificationSent ? '' : 'សំណើត្រូវបានរក្សាទុក ប៉ុន្តែមិនអាចផ្ញើដំណឹង Telegram បានទេ។');
      setPayStep(2);
    } catch (error) {
      setTelegramNoticeError(error instanceof Error ? error.message : 'Could not create payment request');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentOrder) return;
    try {
      const query = new URLSearchParams({ orderId: paymentOrder.orderId, claimCode: paymentOrder.claimCode });
      const response = await fetch(`/api/payment-status?${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not check order');
      setPaymentOrder((current) => ({ ...current, status: result.status }));
      if (result.status === 'approved') {
        if (paymentOrder.movieId !== null && paymentOrder.movieId !== undefined) {
          setUnlockedMovieIds((current) => current.includes(paymentOrder.movieId) ? current : [...current, paymentOrder.movieId]);
        }
        else setIsVipUser(true);
        setPayStep(3);
      } else {
        setPaymentStatusMessage('សំណើនៅកំពុងរង់ចាំ Admin ពិនិត្យប្រាក់ចូល ABA។');
      }
    } catch {
      setPaymentStatusMessage('មិនអាចពិនិត្យស្ថានភាពបានទេ។ សូមសាកម្ដងទៀត។');
    }
  };

  const loadPaymentOrders = async () => {
    setAdminOrderError('');
    try {
      const headers = { 'x-admin-password': adminPassword };
      const [ordersResponse, analyticsResponse] = await Promise.all([
        fetch('/api/admin/orders', { headers }),
        fetch('/api/admin/analytics', { headers }),
      ]);
      const [orders, summary] = await Promise.all([ordersResponse.json(), analyticsResponse.json()]);
      if (!ordersResponse.ok) throw new Error(orders.error || 'Could not load orders');
      if (!analyticsResponse.ok) throw new Error(summary.error || 'Could not load analytics');
      setPaymentOrders(orders);
      setAnalytics(summary);
      setIsAdminAuthenticated(true);
    } catch (error) {
      setIsAdminAuthenticated(false);
      setAnalytics(null);
      setAdminOrderError(error instanceof Error ? error.message : 'Could not load orders');
    }
  };

  const openAdminPanel = () => {
    // Customer sign-in (including Google) never carries over as Admin access.
    setAdminPassword('');
    setIsAdminAuthenticated(false);
    setPaymentOrders([]);
    setAnalytics(null);
    setAdminOrderError('');
    setActiveTab((tab) => tab === 'admin' ? 'home' : 'admin');
  };

  const approvePaymentOrder = async (orderId) => {
    if (!window.confirm('តើអ្នកបានឃើញប្រាក់ចូលក្នុង ABA ពិតប្រាកដហើយឬនៅ? ចុច OK ដើម្បីអនុម័ត និងដោះសោរឿងឲ្យអតិថិជន។')) return;
    setAdminOrderError('');
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/approve`, {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not approve order');
      setPaymentOrders((orders) => orders.map((order) => order.id === orderId ? { ...order, status: 'approved' } : order));
      const approvedOrder = paymentOrders.find((order) => order.id === orderId);
      if (approvedOrder && currentUser?.email?.toLowerCase() === approvedOrder.customerEmail?.toLowerCase()) {
        if (approvedOrder.movieId == null) setIsVipUser(true);
        else setUnlockedMovieIds((ids) => ids.includes(approvedOrder.movieId) ? ids : [...ids, approvedOrder.movieId]);
        setPaymentOrder((current) => current?.orderId === orderId ? { ...current, status: 'approved' } : current);
      }
    } catch (error) {
      setAdminOrderError(error instanceof Error ? error.message : 'Could not approve order');
    }
  };

  const refreshCustomerAccess = async () => {
    setCustomerAccessMessage('');
    try {
      const account = await refreshAccount();
      if (!account.user) throw new Error('សូមចូលគណនីអតិថិជនមុនសិន។');
      setCustomerAccessMessage('បានធ្វើបច្ចុប្បន្នភាពសិទ្ធិគណនីរួចហើយ។ សាកចុចរឿងម្តងទៀត។');
    } catch (error) {
      setCustomerAccessMessage(error instanceof Error ? error.message : 'មិនអាចធ្វើបច្ចុប្បន្នភាពសិទ្ធិបានទេ។');
    }
  };

  const resetMovieForm = () => {
    setEditingMovieId(null);
    setNewMovie({ title: '', category: 'Action', isPaid: false, price: '$1.00', duration: '1h 00m', cover: '', videoUrl: '', description: '' });
  };

  const startEditingMovie = (movie) => {
    setEditingMovieId(movie.id);
    setNewMovie({
      title: movie.title || '',
      category: movie.category || 'Action',
      isPaid: Boolean(movie.isPaid),
      price: movie.price && movie.price !== 'FREE' ? movie.price : '$1.00',
      duration: movie.duration || '1h 00m',
      cover: movie.cover || '',
      coverBlob: movie.coverBlob || null,
      videoUrl: movie.videoUrl || '',
      videoBlob: movie.videoBlob || null,
      description: movie.description || '',
    });
  };

  // Add or update a movie (Admin)
  const handleAddMovie = (e) => {
    e.preventDefault();
    if (!newMovie.title || !newMovie.videoUrl) return alert("សូមបំពេញព័ត៌មានចាំបាច់ និងជ្រើសរើសវីដេអូ!");
    if (editingMovieId !== null) {
      setMovies((currentMovies) => currentMovies.map((movie) => movie.id === editingMovieId ? {
        ...movie,
        ...newMovie,
        id: movie.id,
        price: newMovie.isPaid ? (newMovie.price || '$1.00') : 'FREE',
        cover: newMovie.cover || movie.cover || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
        videoUrl: newMovie.videoUrl || movie.videoUrl,
      } : movie));
      if (selectedMovie?.id === editingMovieId) setSelectedMovie((movie) => ({ ...movie, ...newMovie }));
    } else {
      const created = {
        ...newMovie,
        id: Date.now(),
        rating: '5.0',
        views: '1',
        price: newMovie.isPaid ? (newMovie.price || '$1.00') : 'FREE',
        cover: newMovie.cover || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80',
      };
      setMovies((currentMovies) => [created, ...currentMovies]);
    }
    resetMovieForm();
  };

  // Toggle Free/Paid Status (Admin)
  const togglePaidStatus = (id) => {
    setMovies(movies.map(m => m.id === id ? { ...m, isPaid: !m.isPaid, price: !m.isPaid ? "$1.99" : "FREE" } : m));
  };

  // Delete Movie (Admin)
  const deleteMovie = (id) => {
    if (confirm("តើអ្នកប្រាកដថានឹងលុបរឿងនេះ?")) {
      setMovies(movies.filter(m => m.id !== id));
    }
  };

  const continueWatching = watchProgress
    .filter((progress) => progress.currentTime > 0 && progress.duration > progress.currentTime + 30)
    .map((progress) => ({ ...progress, movie: movies.find((movie) => movie.id === progress.movieId) }))
    .filter((progress) => progress.movie)
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header / Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="p-2 bg-gradient-to-tr from-red-600 to-amber-500 rounded-xl shadow-lg shadow-red-900/30">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
                ខ្មែរ AI ភាពយន្ត
              </h1>
              <p className="text-xs text-slate-400">Khmer AI Cinema & Streaming</p>
            </div>

          </div>

          {/* Search Bar */}
          {activeTab === 'home' && (
            <div className="relative flex-1 max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="ស្វែងរកចំណងជើងរឿង AI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-red-500 text-slate-200"
              />
            </div>
          )}

          {/* Separate customer navigation from the Admin workspace */}
          {activeTab === 'admin' ? (
            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold tracking-wide text-red-200">អ្នកគ្រប់គ្រង · ADMIN</span>
              <button type="button" onClick={() => setActiveTab(currentUser ? 'customer' : 'home')} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20">អតិថិជន · CUSTOMER</button>
            </div>
          ) : <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5">
                <UserRound className="h-4 w-4 text-emerald-300" />
                <span className="max-w-32 truncate text-xs text-slate-200">{currentUser.name}</span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">CUSTOMER</span>
                <button type="button" onClick={signOut} title="Sign out" className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><LogOut className="h-4 w-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => { setAuthMode('login'); setCheckoutAfterAuth(false); setShowAuthModal(true); }} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">ចូលគណនី</button>
            )}
            <button type="button" onClick={() => setActiveTab('customer')} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${activeTab === 'customer' ? 'border-emerald-400 bg-emerald-600 text-white' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'}`}>អតិថិជន · CUSTOMER</button>
            {paymentOrder?.status === 'pending' && (
              <button type="button" onClick={() => {
                setPendingMovie(paymentOrder.movieId == null ? null : movies.find((movie) => movie.id === paymentOrder.movieId) || null);
                setPayStep(2);
                setShowPayModal(true);
              }} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                Check payment
              </button>
            )}
            {isVipUser ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold rounded-full">
                <Crown className="w-3.5 h-3.5" /> VIP Member
              </span>
            ) : (
              <button 
                onClick={() => {
                  setPendingMovie(null);
                  if (currentUser) { setPayStep(1); setShowPayModal(true); }
                  else { setAuthMode('signup'); setCheckoutAfterAuth(true); setShowAuthModal(true); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-red-600 hover:opacity-90 text-white text-xs font-bold rounded-lg shadow-md"
              >
                <Crown className="w-3.5 h-3.5" /> ទិញ VIP មើលទាំងអស់
              </button>
            )}

            <button 
              onClick={openAdminPanel}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${activeTab === 'admin' ? 'border-red-500 bg-red-600 text-white' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              title="Admin is separate from customer Gmail login"
              aria-label="Admin login ដាច់ដោយឡែកពីគណនីអតិថិជន"
            >
              <Settings className="h-4 w-4" />
              <span>អ្នកគ្រប់គ្រង · ADMIN</span>
            </button>
          </div>}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-4 text-xs" role={storageError ? 'alert' : 'status'} aria-live="polite">
          {storageError ? (
            <p className="text-red-400">
              មិនអាចរក្សាទុកទិន្នន័យក្នុង browser បានទេ។ សូមពិនិត្យទំហំផ្ទុក ឬសិទ្ធិ browser រួចសាកល្បងម្ដងទៀត។ ({storageError})
            </p>
          ) : (
            <p className="text-slate-500">
              ការរក្សាទុកដោយស្វ័យប្រវត្តិត្រូវបានបើកក្នុង browser នេះ
            </p>
          )}
          {watchError && <p className="mt-1 text-amber-300">{watchError}</p>}
        </div>
        
        {/* VIEW 1: WATCH MOVIE PLAYER */}
        {activeTab === 'watch' && selectedMovie && (
          <div className="space-y-6">
            <button 
              onClick={() => setActiveTab('home')} 
              className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> ត្រឡប់ទៅទំព័រដើម
            </button>

            {/* Video Player Box */}
            <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 aspect-video relative">
              <video 
                src={selectedMovie.videoUrl} 
                controls 
                autoPlay
                className="w-full h-full object-contain"
                poster={selectedMovie.cover}
                onLoadedMetadata={(event) => {
                  const saved = watchProgress.find((item) => item.movieId === selectedMovie.id);
                  if (saved && saved.currentTime > 10 && saved.currentTime < event.currentTarget.duration - 30) {
                    event.currentTarget.currentTime = saved.currentTime;
                  }
                }}
                onTimeUpdate={(event) => {
                  const { currentTime, duration } = event.currentTarget;
                  const saved = watchProgress.find((item) => item.movieId === selectedMovie.id);
                  if (!saved || Math.abs(currentTime - saved.currentTime) >= 10) {
                    updateWatchProgress(selectedMovie.id, currentTime, duration);
                  }
                }}
                onPause={(event) => updateWatchProgress(selectedMovie.id, event.currentTarget.currentTime, event.currentTarget.duration)}
                onEnded={() => clearWatchProgress(selectedMovie.id)}
              >
                កម្មវិធីជ្រោយរបស់អ្នកមិនគាំទ្រការចាក់វីដេអូនេះទេ។
              </video>
            </div>
            {watchError && <p className="text-sm text-amber-300" role="status">{watchError}</p>}

            {/* Video Info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{selectedMovie.title}</h1>
                  <p className="text-sm text-slate-400">{selectedMovie.titleEn} • {selectedMovie.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs">
                    ទស្សនា: {selectedMovie.views} ដង
                  </span>
                  <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold">
                    ⭐ {selectedMovie.rating}
                  </span>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed border-t border-slate-800/80 pt-4">
                {selectedMovie.description}
              </p>
              <div className="flex flex-wrap gap-3 border-t border-slate-800/80 pt-4">
                <button type="button" onClick={() => toggleFavorite(selectedMovie.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-pink-500/50">
                  <Heart className={`h-4 w-4 ${favorites.includes(selectedMovie.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
                  {favorites.includes(selectedMovie.id) ? 'បានរក្សាទុកក្នុងបញ្ជីចង់មើល' : 'បន្ថែមទៅបញ្ជីចង់មើល'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMER DASHBOARD: account, access, payment status, and personal library */}
        {activeTab === 'customer' && (
          <div className="space-y-6">
            {currentUser ? <>
              <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">ផ្ទាំងអតិថិជន · CUSTOMER DASHBOARD</p>
                    <h2 className="mt-2 text-2xl font-black text-white">សួស្តី {currentUser.name}</h2>
                    <p className="mt-2 text-sm text-slate-400">គណនីអតិថិជន · {currentUser.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={refreshCustomerAccess} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20">ធ្វើបច្ចុប្បន្នភាពសិទ្ធិ</button>
                    <button type="button" onClick={() => setActiveTab('home')} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Browse movies</button>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4"><p className="text-xs text-slate-400">Account status</p><p className={`mt-1 font-bold ${isVipUser ? 'text-amber-300' : 'text-emerald-300'}`}>{isVipUser ? 'VIP Active' : 'Customer'}</p></div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4"><p className="text-xs text-slate-400">Unlocked VIP movies</p><p className="mt-1 font-bold text-white">{isVipUser ? 'VIP access' : `${unlockedMovieIds.length} movies`}</p></div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-4"><p className="text-xs text-slate-400">Latest payment request</p><p className={`mt-1 font-bold ${paymentOrder?.status === 'pending' ? 'text-amber-300' : paymentOrder?.status === 'approved' ? 'text-emerald-300' : 'text-slate-300'}`}>{paymentOrder?.status === 'pending' ? 'Pending review' : paymentOrder?.status === 'approved' ? 'Approved' : 'No requests'}</p></div>
                </div>
                {!isVipUser && <button type="button" onClick={() => { setPendingMovie(null); setPayStep(1); setShowPayModal(true); }} className="mt-5 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 px-5 py-2.5 text-sm font-bold text-white">Get VIP access</button>}
                {paymentOrder?.status === 'pending' && <button type="button" onClick={() => { setPendingMovie(paymentOrder.movieId == null ? null : movies.find((movie) => movie.id === paymentOrder.movieId) || null); setPayStep(2); setShowPayModal(true); }} className="ml-3 mt-5 rounded-xl border border-amber-500/30 px-5 py-2.5 text-sm font-semibold text-amber-200">Check payment status</button>}
                {customerAccessMessage && <p className="mt-4 text-sm text-emerald-200" role="status">{customerAccessMessage}</p>}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-lg font-bold text-white">My unlocked movies</h3><p className="mt-1 text-sm text-slate-400">ភាពយន្ត VIP ដែលគណនីនេះមានសិទ្ធិមើល</p></div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{isVipUser ? movies.filter((movie) => movie.isPaid).length : unlockedMovieIds.length} titles</span>
                </div>
                {(isVipUser ? movies.filter((movie) => movie.isPaid) : movies.filter((movie) => movie.isPaid && unlockedMovieIds.includes(movie.id))).length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {(isVipUser ? movies.filter((movie) => movie.isPaid) : movies.filter((movie) => movie.isPaid && unlockedMovieIds.includes(movie.id))).map((movie) => <button key={movie.id} type="button" onClick={() => handlePlayMovie(movie)} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-left transition hover:border-emerald-500/50"><img src={movie.cover} alt={movie.title} className="aspect-[3/4] w-full object-cover" /><span className="block truncate p-3 text-sm font-semibold text-white">{movie.title}</span></button>)}
                  </div>
                ) : <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-400">មិនទាន់មានរឿង VIP ដែលបានដោះសោទេ។ អ្នកអាចមើលរឿង FREE នៅក្នុងបញ្ជីភាពយន្ត។</div>}
              </section>
              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className="text-lg font-bold text-white">បន្តមើល</h3>
                  {continueWatching.length ? continueWatching.slice(0, 5).map(({ movie, currentTime, duration }) => (
                    <button key={movie.id} type="button" onClick={() => handlePlayMovie(movie)} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-slate-950 p-3 text-left">
                      <img src={movie.cover} alt="" className="h-14 w-12 rounded object-cover" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{movie.title}</span><span className="text-xs text-slate-400">{Math.floor((duration - currentTime) / 60)} នាទីនៅសល់</span><span className="mt-1 block h-1 rounded bg-slate-700"><span className="block h-full rounded bg-red-500" style={{ width: `${Math.min(100, currentTime / duration * 100)}%` }} /></span></span>
                    </button>
                  )) : <p className="mt-3 text-sm text-slate-400">ប្រវត្តិបន្តមើលនឹងបង្ហាញនៅទីនេះ។</p>}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className="text-lg font-bold text-white">បញ្ជីចង់មើល</h3>
                  {movies.filter((movie) => favorites.includes(movie.id)).length ? movies.filter((movie) => favorites.includes(movie.id)).slice(0, 5).map((movie) => (
                    <button key={movie.id} type="button" onClick={() => handlePlayMovie(movie)} className="mt-3 flex w-full items-center gap-3 rounded-xl bg-slate-950 p-3 text-left">
                      <img src={movie.cover} alt="" className="h-14 w-12 rounded object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{movie.title}</span>
                      <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
                    </button>
                  )) : <p className="mt-3 text-sm text-slate-400">ចុចរូបបេះដូងលើភាពយន្ត ដើម្បីរក្សាទុកក្នុងបញ្ជីនេះ។</p>}
                </div>
              </section>
            </> : <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><h2 className="text-xl font-bold text-white">Customer dashboard</h2><p className="mt-2 text-sm text-slate-400">សូមចូលគណនីអតិថិជន ដើម្បីមើលព័ត៌មាន និងសិទ្ធិរបស់អ្នក។</p><button type="button" onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</button></section>}
          </div>
        )}
        {/* VIEW 2: HOME / CATALOG */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            
            {/* Banner Section */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 border border-slate-800 p-8 md:p-12 shadow-2xl">
              <div className="relative z-10 max-w-xl space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600/30 border border-red-500/40 text-red-400 text-xs font-semibold rounded-full">
                  🔥 AI Generated Kh-Dubbed
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
                  ទស្សនាភាពយន្ត AI ភាសាខ្មែរដំបូងគេ
                </h2>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed">
                  សម្រិតសម្រាំងរឿងភាគ និងភាពយន្ត AI គុណភាពខ្ពស់ និយាយភាសាខ្មែរយ៉ាងរលូន។ មានទាំងជម្រើសទស្សនា **FREE** និង **VIP Exclusive**!
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <button 
                    onClick={() => setFilter('free')}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
                  >
                    មើលរឿង FREE
                  </button>
                  <button 
                    onClick={() => setFilter('paid')}
                    className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-500 hover:opacity-90 text-white rounded-xl text-sm font-semibold shadow-lg shadow-red-900/40 transition"
                  >
                    រឿង VIP/បង់លុយ
                  </button>
                </div>
              </div>
            </div>

            {continueWatching.length > 0 && filter === 'all' && (
              <section className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-white"><Clock3 className="h-5 w-5 text-amber-400" /> បន្តមើល</h3>
                  <p className="mt-1 text-xs text-slate-400">បន្តពីកន្លែងដែលអ្នកបានឈប់មើលលើគណនី ឬ browser នេះ</p>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {continueWatching.slice(0, 4).map(({ movie, currentTime, duration }) => (
                    <button key={movie.id} type="button" onClick={() => handlePlayMovie(movie)} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-left hover:border-amber-500/50">
                      <img src={movie.cover} alt={movie.title} className="aspect-video w-full object-cover" />
                      <span className="block truncate px-3 pt-3 text-sm font-semibold text-white">{movie.title}</span>
                      <span className="block px-3 pb-2 text-xs text-slate-400">នៅសល់ {Math.floor((duration - currentTime) / 60)} នាទី</span>
                      <span className="block h-1 bg-slate-700"><span className="block h-full bg-red-500" style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }} /></span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Filter Buttons */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex gap-2">
                {[
                  { key: 'all', label: 'ទាំងអស់' },
                  { key: 'free', label: 'មើល Free' },
                  { key: 'paid', label: 'រឿង បង់លុយ (VIP)' },
                  { key: 'favorites', label: 'បញ្ជីចង់មើល' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                      filter === tab.key 
                        ? 'bg-red-600 text-white shadow-md shadow-red-900/30' 
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">
                បង្ហាញ {filteredMovies.length} រឿង
              </span>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">ប្រភេទភាពយន្ត</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'គ្រប់ប្រភេទ' },
                  ...movieCategories.map((category) => ({
                    key: category,
                    label: ({
                      Action: 'សកម្មភាព',
                      Drama: 'ជីវិត',
                      Fantasy: 'រវើរវាយ',
                      Hero: 'វីរបុរស',
                      Horror: 'រន្ធត់',
                      Romance: 'ស្នេហា',
                      'Sci-Fi': 'វិទ្យាសាស្ត្រ',
                    })[category] || category,
                  })),
                ].map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setCategoryFilter(category.key)}
                    aria-pressed={categoryFilter === category.key}
                    className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                      categoryFilter === category.key
                        ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Movie Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {filteredMovies.map((movie) => {
                return (
                  <div 
                    key={movie.id}
                    onClick={() => handlePlayMovie(movie)}
                    className="group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-red-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-red-900/10 cursor-pointer flex flex-col"
                  >
                    {/* Poster Cover */}
                    <div className="relative aspect-[2/3] overflow-hidden bg-slate-950">
                      <img 
                        src={movie.cover} 
                        alt={movie.title}
                        className="h-full w-full object-contain"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30" />

                      {/* Free / Paid Badge */}
                      <div className="absolute top-3 left-3">
                        {movie.isPaid ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-lg shadow">
                            <Lock className="w-3 h-3" /> VIP ({movie.price})
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 text-slate-950 text-[10px] font-extrabold rounded-lg shadow">
                            <Unlock className="w-3 h-3" /> FREE
                          </span>
                        )}
                      </div>
                      <div className="absolute right-3 top-3 flex gap-2">
                        <button type="button" onClick={(event) => { event.stopPropagation(); toggleFavorite(movie.id); }} aria-label={favorites.includes(movie.id) ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`} className="rounded-full bg-slate-950/80 p-2 text-white hover:bg-pink-600">
                          <Heart className={`h-4 w-4 ${favorites.includes(movie.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
                        </button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); setDetailsMovie(movie); }} aria-label={`Details for ${movie.title}`} className="rounded-full bg-slate-950/80 p-2 text-white hover:bg-slate-700">
                          <Info className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Hover Play Button */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-xs transition">
                        <div className="p-4 bg-red-600 rounded-full text-white shadow-lg transform group-hover:scale-110 transition">
                          <Play className="w-6 h-6 fill-white" />
                        </div>
                      </div>

                      {/* Duration */}
                      <span className="absolute bottom-3 right-3 text-[10px] font-medium bg-black/70 text-slate-200 px-2 py-0.5 rounded backdrop-blur-xs">
                        {movie.duration}
                      </span>
                    </div>

                    {/* Movie Info */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h3 className="min-h-12 break-words text-sm font-bold leading-6 text-slate-100 transition group-hover:text-red-400">
                          {movie.title}
                        </h3>
                        <p className="mt-1 break-words text-[11px] text-slate-400">{movie.category}</p>
                      </div>
                      {watchProgress.find((item) => item.movieId === movie.id && item.duration > 0) && (
                        <span className="block h-1 overflow-hidden rounded bg-slate-700">
                          <span className="block h-full bg-red-500" style={{ width: `${Math.min(100, (watchProgress.find((item) => item.movieId === movie.id).currentTime / watchProgress.find((item) => item.movieId === movie.id).duration) * 100)}%` }} />
                        </span>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                        <span>⭐ {movie.rating}</span>
                        <span>{movie.views} views</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredMovies.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                {filter === 'favorites' ? 'បញ្ជីចង់មើលរបស់អ្នកនៅទទេ។ ចុចរូបបេះដូងលើរឿងដើម្បីរក្សាទុក។' : 'រកមិនឃើញរឿងដែលត្រូវនឹងការស្វែងរកទេ។'}
              </p>
            )}
          </div>
        )}

        {/* VIEW 3: ADMIN PANEL */}
        {activeTab === 'admin' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-red-500" />
                <div>
                <h2 className="text-xl font-bold text-white">ផ្ទាំងអ្នកគ្រប់គ្រង · ADMIN DASHBOARD</h2>
                  <p className="text-xs text-slate-400">គ្រប់គ្រងរឿង AI កំណត់រឿង Free ឬបង់លុយ និងបន្ថែមរឿងថ្មីៗ</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsAdminAuthenticated(false); setAdminPassword(''); setPaymentOrders([]); setAdminOrderError(''); setActiveTab(currentUser ? 'customer' : 'home'); }}
                className="px-4 py-2 bg-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-700"
              >
                ត្រឡប់ទៅការមើល
              </button>
            </div>

            {!isAdminAuthenticated && <section className="mx-auto w-full max-w-2xl rounded-2xl border border-red-500/20 bg-slate-900 p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="text-lg font-bold text-white">Admin sign in</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">Gmail login is for customers. Enter the separate Admin password to open the management dashboard.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="password" autoComplete="current-password" value={adminPassword} onChange={(event) => { setAdminPassword(event.target.value); setIsAdminAuthenticated(false); setPaymentOrders([]); }} placeholder="Admin password" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                <button type="button" onClick={loadPaymentOrders} disabled={!adminPassword} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">Sign in to Admin</button>
              </div>
              {adminOrderError && <p className="text-sm text-red-300" role="alert">{adminOrderError}</p>}
            </section>}


            {isAdminAuthenticated && <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Admin dashboard</p>
                <h3 className="mt-1 text-lg font-bold text-white">System overview</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"><p className="text-xs text-slate-400">All movies</p><p className="mt-1 text-2xl font-bold text-white">{movies.length}</p></div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-xs text-slate-400">VIP movies</p><p className="mt-1 text-2xl font-bold text-amber-300">{movies.filter((movie) => movie.isPaid).length}</p></div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-xs text-slate-400">ABA requests awaiting review</p><p className="mt-1 text-2xl font-bold text-emerald-300">{paymentOrders.filter((order) => order.status === 'pending').length}</p></div>
              </div>
              {analytics && <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div><h4 className="text-base font-bold text-white">ស្ថិតិការប្រើប្រាស់ · Analytics</h4><p className="mt-1 text-xs text-slate-400">រាប់ការចាក់ដែលបានចាប់ផ្ដើមដោយអ្នកប្រើប្រាស់ដែលបានចូលគណនី</p></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">ទស្សនាសរុប</p><p className="mt-1 text-2xl font-bold text-white">{analytics.totalViews}</p></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">ទស្សនា ៧ ថ្ងៃ</p><p className="mt-1 text-2xl font-bold text-amber-300">{analytics.viewsLast7Days}</p></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">អ្នកទស្សនាខុសគ្នា ៧ ថ្ងៃ</p><p className="mt-1 text-2xl font-bold text-emerald-300">{analytics.uniqueViewersLast7Days}</p></div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">សំណើបានអនុម័ត</p><p className="mt-1 text-2xl font-bold text-white">{analytics.approvedOrders}</p></div>
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-slate-200">រឿងដែលមានអ្នកមើលច្រើន</h5>
                  {analytics.topMovies.length ? <ol className="mt-2 space-y-2">{analytics.topMovies.map((entry) => {
                    const movie = movies.find((item) => item.id === entry.movieId);
                    return <li key={entry.movieId} className="flex justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2 text-sm"><span className="truncate text-slate-200">{movie?.title || `Movie #${entry.movieId}`}</span><span className="shrink-0 text-slate-400">{entry.views} ដង</span></li>;
                  })}</ol> : <p className="mt-2 text-sm text-slate-400">មិនទាន់មានទិន្នន័យទស្សនា។</p>}
                </div>
              </section>}
              <div>
                <h4 className="pb-2 text-sm font-bold text-white">ABA payment requests</h4>
                <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100">១. បើក ABA របស់អ្នក ហើយផ្ទៀងផ្ទាត់ប្រាក់ចូល និងចំនួនឲ្យត្រូវនឹងសំណើ។ ២. ចុចប៊ូតុងពណ៌បៃតងលើសំណើនោះ ដើម្បីអនុម័ត។ បើប្រាក់មិនទាន់ចូល សូមទុក Pending។</p>
                {adminOrderError && <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300" role="alert">{adminOrderError}</p>}
                {paymentOrders.length > 0 ? <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 px-3">
                  {paymentOrders.map((order) => (
                    <div key={order.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-white">{order.item} · {order.amount}</p>
                        <p className="text-slate-400">Customer: {order.customerName} · {order.customerEmail}</p>
                        <p className="break-all text-xs text-slate-500">Order {order.id} · Code {order.claimCode} · {new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      {order.status === 'pending' ? <button type="button" onClick={() => approvePaymentOrder(order.id)} className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">ប្រាក់ចូល ABA ហើយ · អនុម័ត</button> : <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">បានអនុម័ត</span>}
                    </div>
                  ))}
                </div> : <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">No ABA payment requests yet.</p>}
              </div>
            </section>}
            {isAdminAuthenticated && <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Add New Movie */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                  {editingMovieId !== null ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {editingMovieId !== null ? 'កែព័ត៌មានរឿង' : 'បន្ថែមរឿង AI ថ្មី'}
                </h3>
                <form onSubmit={handleAddMovie} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">ចំណងជើងរឿង (ខ្មែរ)</label>
                    <input 
                      type="text" 
                      required
                      value={newMovie.title}
                      onChange={e => setNewMovie({...newMovie, title: e.target.value})}
                      placeholder="ឧ. រឿង អាថ៌កំបាំងព្រៃក្រាស់"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">ប្រភេទ (Category)</label>
                      <select 
                        value={newMovie.category}
                        onChange={e => setNewMovie({...newMovie, category: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      >
                        <option>Action</option>
                        <option>Horror</option>
                        <option>Romance</option>
                        <option>Sci-Fi</option>
                        <option>Fantasy</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">រៀបចំសិទ្ធិមើល</label>
                      <select 
                        value={newMovie.isPaid ? 'paid' : 'free'}
                        onChange={e => setNewMovie({...newMovie, isPaid: e.target.value === 'paid'})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      >
                        <option value="free">មើល FREE</option>
                        <option value="paid">ត្រូវបង់លុយ (VIP)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">រយៈពេល (Duration)</label>
                    <input
                      type="text"
                      value={newMovie.duration}
                      onChange={e => setNewMovie({ ...newMovie, duration: e.target.value })}
                      placeholder="1h 00m"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  {newMovie.isPaid && (
                    <div>
                      <label className="block text-slate-400 mb-1">តម្លៃ ($)</label>
                      <input 
                        type="text" 
                        value={newMovie.price}
                        onChange={e => setNewMovie({...newMovie, price: e.target.value})}
                        placeholder="$1.99"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      />
                    </div>
                  )}

                  {/* Cover Input + File Upload Option */}
                  <div>
                    <label className="block text-slate-400 mb-1">Cover Image (តំណរូបភាព ឬជ្រើសរើស File)</label>
                    <input 
                      type="url" 
                      value={newMovie.cover}
                      onChange={e => setNewMovie({...newMovie, cover: e.target.value, coverBlob: null})}
                      placeholder="https://..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white mb-1.5"
                    />
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleCoverFileUpload}
                      className="w-full text-slate-400 text-[11px] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                    />
                    {newMovie.cover && (
                      <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-2">
                        <img src={newMovie.cover} alt="Thumbnail preview" className="h-20 w-14 rounded-md object-cover" />
                        <span className="text-[11px] text-slate-400">Thumbnail preview — រូបនេះនឹងបង្ហាញលើកាតរឿង</span>
                      </div>
                    )}
                  </div>

                  {/* Video Input + File Upload Option */}
                  <div>
                    <label className="block text-slate-400 mb-1">Video MP4 (តំណវីដេអូ ឬជ្រើសរើស File ពីកុំព្យូទ័រ)</label>
                    <input 
                      type="url" 
                      value={newMovie.videoUrl}
                      onChange={e => setNewMovie({...newMovie, videoUrl: e.target.value, videoBlob: null})}
                      placeholder="https://.../video.mp4"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white mb-1.5"
                    />
                    <input 
                      type="file" 
                      accept="video/*"
                      onChange={handleVideoFileUpload}
                      className="w-full text-slate-400 text-[11px] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:bg-red-600/80 file:text-white hover:file:bg-red-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">ការពណ៌នាសង្ខេប</label>
                    <textarea 
                      rows="3"
                      value={newMovie.description}
                      onChange={e => setNewMovie({...newMovie, description: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    ></textarea>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-red-600 hover:bg-red-500 font-bold text-white rounded-lg transition"
                  >
                    {editingMovieId !== null ? 'រក្សាទុកការកែប្រែ' : 'រក្សាទុក និងបង្ហោះ'}
                  </button>
                  {editingMovieId !== null && (
                    <button type="button" onClick={resetMovieForm} className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 font-bold text-white rounded-lg transition">
                      បោះបង់ការកែប្រែ
                    </button>
                  )}
                </form>
              </div>

              {/* Manage Existing Movies */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-base font-bold text-white">បញ្ជីរឿងទាំងអស់ ({movies.length})</h3>
                <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto pr-2">
                  {movies.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img src={m.cover} alt="" className="w-12 h-12 object-cover rounded-lg" />
                        <div>
                          <h4 className="font-bold text-sm text-slate-200">{m.title}</h4>
                          <p className="text-[11px] text-slate-400">{m.category} • {m.duration}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingMovie(m)}
                          aria-label={`Edit ${m.title}`}
                          title="Edit movie"
                          className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Toggle Free/Paid Button */}
                        <button 
                          onClick={() => togglePaidStatus(m.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            m.isPaid 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {m.isPaid ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          {m.isPaid ? `Paid (${m.price})` : 'Free'}
                        </button>

                        <button 
                          onClick={() => deleteMovie(m.id)}
                          className="p-2 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>}
          </div>
        )}

      </main>

      {detailsMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setDetailsMovie(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="movie-details-title" className="relative grid w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 md:grid-cols-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setDetailsMovie(null)} aria-label="Close movie details" className="absolute right-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-white hover:bg-slate-700">✕</button>
            <img src={detailsMovie.cover} alt={detailsMovie.title} className="h-64 w-full object-cover md:h-full" />
            <div className="space-y-4 p-6">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${detailsMovie.isPaid ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                {detailsMovie.isPaid ? `VIP · ${detailsMovie.price}` : 'FREE'}
              </span>
              <div>
                <h2 id="movie-details-title" className="text-2xl font-bold text-white">{detailsMovie.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{detailsMovie.titleEn || 'ភាពយន្តខ្មែរ'} · {detailsMovie.category}</p>
              </div>
              <div className="flex gap-4 text-sm text-slate-300"><span>⭐ {detailsMovie.rating}</span><span>{detailsMovie.duration}</span><span>{detailsMovie.views} views</span></div>
              <p className="text-sm leading-6 text-slate-300">{detailsMovie.description || 'មិនទាន់មានការពិពណ៌នាសម្រាប់ភាពយន្តនេះទេ។'}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => handlePlayMovie(detailsMovie)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500"><Play className="h-4 w-4" /> មើលរឿង</button>
                <button type="button" onClick={() => toggleFavorite(detailsMovie.id)} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:border-pink-500/50">
                  <Heart className={`h-4 w-4 ${favorites.includes(detailsMovie.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
                  {favorites.includes(detailsMovie.id) ? 'ដកចេញពីបញ្ជី' : 'ចង់មើល'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Personal ABA KHQR payment (manual confirmation) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full relative space-y-6 shadow-2xl">
            <button 
              onClick={() => { setShowPayModal(false); setPayStep(1); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            {payStep === 1 && (
              <div className="space-y-5 text-center">
                <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {pendingMovie ? `ទិញមើលរឿង: ${pendingMovie.title}` : "ជាវកញ្ចប់ VIP Member"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {pendingMovie ? `តម្លៃត្រឹមតែ ${pendingMovie.price} ដើម្បីមើលរឿងនេះ` : "ទស្សនារឿង AI ទាំងអស់គ្មានដែនកំណត់ត្រឹម $4.99/ខែ"}
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>ប្រភេទសេវា:</span>
                    <span className="font-bold">{pendingMovie ? "ទិញរឿងដាច់" : "VIP Monthly Pass"}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>តម្លៃសរុប:</span>
                    <span className="font-bold text-amber-400">{pendingMovie ? pendingMovie.price : "$4.99"}</span>
                  </div>
                </div>

                <p className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-left text-xs text-slate-300">Signed in as <span className="font-semibold text-white">{currentUser?.email}</span>. This request will be attached to this account.</p>
                <button 
                  onClick={confirmPayment}
                  disabled={!currentUser || isCreatingOrder}
                  className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-500 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 font-bold text-white rounded-xl shadow-lg"
                >
                  បង្ហាញ KHQR សម្រាប់ទូទាត់
                </button>
              </div>
            )}

            {payStep === 2 && (
              <div className="space-y-4 text-center">
                <h3 className="text-lg font-bold text-white">ស្កេន KHQR ដើម្បីបង់ប្រាក់</h3>
                <p className="text-sm text-slate-300">គណនី៖ CHUMCHEAT HAN · ABA</p>
                {paymentOrder && <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-left text-xs text-slate-300"><p>លេខសំណើ៖ <code className="select-all text-amber-300">{paymentOrder.orderId}</code></p><p className="mt-1">កូដសំណើ៖ <code className="select-all text-amber-300">{paymentOrder.claimCode}</code></p><p className="mt-1">សូមរក្សាកូដនេះទុកសម្រាប់ពិនិត្យស្ថានភាព។</p></div>}
                <div className="mx-auto w-full max-w-xs rounded-2xl bg-white p-3">
                  <img src="/photo_2026-10-21_08-44-19.jpg" alt="Personal ABA KHQR for CHUMCHEAT HAN" className="block w-full rounded-lg" onLoad={(event) => { event.currentTarget.nextElementSibling.style.display = 'none'; }} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <p className="py-6 text-sm text-slate-700">រកមិនឃើញរូប KHQR ក្នុងថត <code>public</code></p>
                </div>
                <p className="text-xs text-slate-400">ចំនួនប្រាក់៖ {pendingMovie ? pendingMovie.price : '$4.99'} · សូមពិនិត្យឈ្មោះអ្នកទទួល CHUMCHEAT HAN មុនបញ្ជាក់។</p>
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">ការបង់ប្រាក់ត្រូវពិនិត្យដោយម្ចាស់គណនី។ កម្មវិធីមិនទាន់អាចផ្ទៀងផ្ទាត់ ឬបើក VIP ដោយស្វ័យប្រវត្តិទេ។</p>
                {paymentStatusMessage && <p className="text-xs text-amber-200" role="status">{paymentStatusMessage}</p>}
                <button type="button" onClick={checkPaymentStatus} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500">ពិនិត្យស្ថានភាព / អនុវត្តការដោះសោ</button>
                {telegramNoticeError && <p className="text-xs text-red-300" role="alert">{telegramNoticeError}</p>}
                <button type="button" onClick={() => { setShowPayModal(false); setPayStep(1); }} className="w-full rounded-xl bg-slate-700 py-3 font-bold text-white hover:bg-slate-600">បិទ</button>
              </div>
            )}

            {payStep === 3 && (
              <div className="space-y-5 py-2 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-400">?</div>
                <div>
                  <h3 className="text-xl font-bold text-white">Payment approved</h3>
                  <p className="mt-1 text-xs text-slate-400">The admin verified and approved this payment request.</p>
                </div>
                <button type="button" onClick={() => {
                  setShowPayModal(false);
                  const movie = paymentOrder?.movieId == null ? null : movies.find((entry) => entry.id === paymentOrder.movieId);
                  if (movie) { setSelectedMovie(movie); setActiveTab('watch'); }
                }} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500">Start watching</button>
              </div>
            )}

          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section className="relative w-full max-w-md space-y-5 rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <button type="button" onClick={() => { setShowAuthModal(false); setCheckoutAfterAuth(false); }} className="absolute right-4 top-4 text-slate-400 hover:text-white" aria-label="Close">×</button>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><UserRound className="h-6 w-6" /></div>
              <h2 className="text-xl font-bold text-white">{authMode === 'signup' ? 'បង្កើតគណនីអតិថិជន' : authMode === 'forgot' ? 'ស្តារពាក្យសម្ងាត់' : authMode === 'reset' ? 'កំណត់ពាក្យសម្ងាត់ថ្មី' : authMode === 'verify' ? 'កំពុងផ្ទៀងផ្ទាត់អ៊ីមែល' : authMode === 'magic' ? 'ចូលតាមអ៊ីមែល' : 'ចូលគណនី'}</h2>
              <p className="mt-1 text-xs text-slate-400">ចូលគណនីដើម្បីទិញ និងរក្សាសិទ្ធិមើលរឿងរបស់អ្នក។</p>
            </div>
            {['forgot', 'reset', 'magic'].includes(authMode) && <form onSubmit={submitAuth} className="space-y-3">
              {['forgot', 'magic'].includes(authMode) && <input required type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email address" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />}
              {authMode === 'reset' && <input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="New password (at least 8 characters)" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />}
              {authNotice && <p className="text-sm text-emerald-300" role="status">{authNotice}</p>}
              {authError && <p className="text-sm text-red-300" role="alert">{authError}</p>}
              <button type="submit" disabled={isSubmittingAuth} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{isSubmittingAuth ? 'Please wait…' : authMode === 'forgot' ? 'Send reset link' : authMode === 'magic' ? 'Send sign-in link' : 'Save new password'}</button>
            </form>}
            {!['forgot', 'reset', 'magic', 'verify', 'verifyLogin'].includes(authMode) && <form onSubmit={submitAuth} className="space-y-3">
              {authMode === 'signup' && <input required maxLength={80} value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="ឈ្មោះរបស់អ្នក" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-500" />}
              <input required type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="អ៊ីមែល" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-500" />
              <input required type="password" minLength={8} maxLength={128} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="ពាក្យសម្ងាត់ (យ៉ាងតិច ៨ តួ)" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-500" />
              {authNotice && <p className="text-sm text-emerald-300" role="status">{authNotice}</p>}
              {authError && <p className="text-sm text-red-300" role="alert">{authError}</p>}
              <button type="submit" disabled={isSubmittingAuth} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{isSubmittingAuth ? 'កំពុងដំណើរការ…' : authMode === 'signup' ? 'បង្កើតគណនី' : 'ចូលគណនី'}</button>
            </form>}
            {['login', 'signup'].includes(authMode) && <>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-500"><span className="h-px flex-1 bg-slate-700" />or continue with<span className="h-px flex-1 bg-slate-700" /></div>
              <a href="/api/auth/google" className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-base font-bold text-blue-600">G</span>
                Continue with Gmail
              </a>
            </>}
            <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthError(''); }} className="w-full text-sm text-slate-300 hover:text-white">
              {authMode === 'signup' ? 'មានគណនីរួចហើយ? ចូលគណនី' : 'មិនទាន់មានគណនី? បង្កើតគណនី'}
            </button>
            {['forgot', 'reset', 'magic'].includes(authMode) && <button type="button" onClick={() => { setAuthMode('login'); setAuthNotice(''); setAuthError(''); }} className="w-full text-sm text-slate-400 hover:text-white">Back to sign in</button>}
            {authMode === 'login' && <button type="button" onClick={() => { setAuthMode('forgot'); setAuthNotice(''); setAuthError(''); }} className="w-full text-sm text-slate-400 hover:text-white">Forgot your password?</button>}
            {authMode === 'login' && <button type="button" onClick={() => { setAuthMode('magic'); setAuthNotice(''); setAuthError(''); }} className="w-full text-sm text-emerald-300 hover:text-white">Sign in with an email link</button>}
            {authMode === 'login' && authError.includes('Verify your email') && <button type="button" onClick={resendVerification} className="w-full text-sm text-emerald-300 hover:text-white">Resend verification email</button>}
          </section>
        </div>
      )}
    </div>
  );
}
