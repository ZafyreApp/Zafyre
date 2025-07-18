// --- Variáveis Globais ---
let auth;
let db;
let currentUser;
let userProfile = {}; // Armazena os dados do perfil do usuário logado
let currentSection = 'auth-section'; // Seção atual visível
let currentChatId = null;
let currentChatPartner = null;
let dailySwipeCount = 0; // Para controle de swipes diários gratuitos
let dailyMessageCounts = {}; // Armazena mensagens diárias por parceiro de chat
let lastDailyResetDate = ''; // Armazena a data do último reset dos limites diários
let unsubscribeFromMessages = null; // Variável para controlar o listener de mensagens em tempo real
let followingList = []; // Array de UIDs que o currentUser está seguindo

// --- Constantes de Configuração ---
const CLOUDINARY_CONFIG = {
    cloudName: 'dblahe34z', // SEU CLOUD NAME DO CLOUDINAARY
    uploadPreset: 'zafyre_uploads', // SEU UPLOAD PRESET (UNSIGNED)
    folder: {
        profiles: 'zafyre-images/profiles', // Pasta para fotos de perfil
        posts: 'zafyre-images/posts',     // Pasta para imagens de posts
        ppv: 'zafyre-images/ppv_content',  // Pasta para conteúdo PPV
        chat_media: 'zafyre-images/chat_media' // Pasta para mídias de chat
    }
};

// Constantes para limites e custos
const DAILY_FREE_SWIPES = 5; // Número de swipes gratuitos por dia
const DAILY_FREE_MESSAGES = 10; // Número de mensagens gratuitas por dia por usuário (para homens não-premium)
const MESSAGE_COST = 15; // Custo de uma mensagem em ZafyreCoins (para homens não-premium não-seguidores mútuos)
const MINIMUM_MESSAGES_FOR_MEDIA = 10; // Mínimo de mensagens trocadas para desbloquear mídias no chat

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC_51uWY3vxVQ325S5C3wIOnCpTTul7QzM",
  authDomain: "zafyre-app.firebaseapp.com",
  projectId: "zafyre-app",
  storageBucket: "zafyre-app.firebasestorage.app",
  messagingSenderId: "899874302896",
  appId: "1:899874302896:web:2311574e15935cfb77c475",
  measurementId: "G-T9C70PETFN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- Funções Auxiliares e Globais ---

function showSection(sectionId) {
    console.log('Mostrando seção:', sectionId);

    // Primeiro, esconder container de auth se estiver visível
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (sectionId === 'auth-section') {
        if (authContainer) authContainer.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');
        return;
    }

    // Mostrar app container se estiver escondido
    if (authContainer) authContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    // Esconder todas as seções dentro do app
    document.querySelectorAll('.app-content .section').forEach(section => {
        section.classList.add('hidden');
    });

    // Mostrar a seção solicitada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        console.log('Seção mostrada:', sectionId);
    } else {
        console.error('Seção não encontrada:', sectionId);
    }

    // Atualizar navegação ativa
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeNavMap = {
        'feed-section': 'nav-feed',
        'swipe-section': 'nav-swipe', 
        'chat-section': 'nav-chat',
        'profile-section': 'nav-profile'
    };

    const activeNav = document.getElementById(activeNavMap[sectionId]);
    if (activeNav) activeNav.classList.add('active');

    currentSection = sectionId;

    // Ações específicas ao mudar de seção
    if (sectionId === 'feed-section') {
        loadFeed();
    } else if (sectionId === 'chat-section') {
        loadChats();
    } else if (sectionId === 'swipe-section') {
        loadNextExploreProfile();
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found. Message:', message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function updateWalletDisplay() {
    const walletDisplay = document.getElementById('user-zafyre-coins');
    if (walletDisplay && userProfile) {
        walletDisplay.textContent = userProfile.zafyreCoins !== undefined ? userProfile.zafyreCoins : 0;
    }
}

function updateProfileUI() {
    if (!userProfile) return;

    console.log('Atualizando UI do perfil:', userProfile);

    const usernameDisplay = document.getElementById('profile-username-display');
    const bioDisplay = document.getElementById('profile-bio-display');
    const ageDisplay = document.getElementById('profile-age-display');
    const followersCount = document.getElementById('profile-followers-count');
    const postsCount = document.getElementById('profile-posts-count');
    const profilePic = document.getElementById('profile-pic-display');
    const currentUserName = document.getElementById('current-user-name');

    if (usernameDisplay) usernameDisplay.textContent = userProfile.username || 'Novo Usuário';
    if (bioDisplay) bioDisplay.textContent = userProfile.bio || 'Bem-vindo(a) ao seu perfil!';
    if (ageDisplay) ageDisplay.textContent = userProfile.age ? `${userProfile.age}` : '?';
    if (followersCount) followersCount.textContent = userProfile.followers || 0;
    if (postsCount) postsCount.textContent = userProfile.posts || 0;
    if (profilePic) profilePic.src = userProfile.profilePictureUrl || userProfile.profilePicture || 'https://via.placeholder.com/150';
    if (currentUserName) currentUserName.textContent = userProfile.username || 'Usuário';

    updateWalletDisplay();

    const payoutButton = document.getElementById('request-payout-button');
    const zafyrepaySection = document.getElementById('zafyrepay-section');
    const zafyrecreatorsSection = document.getElementById('zafyrecreators-section');
    const creatorBadge = document.getElementById('creator-badge');

    // Mostrar seções específicas para criadoras (gênero feminino)
    if (userProfile.gender === 'Feminino') {
        // Definir automaticamente como criadora se for feminino
        if (!userProfile.isCreator) {
            userProfile.isCreator = true;
            // Atualizar no banco de dados
            db.collection('users').doc(currentUser.uid).update({
                isCreator: true
            }).catch(error => console.log('Erro ao atualizar isCreator:', error));
        }
        
        if (payoutButton) payoutButton.classList.remove('hidden');
        if (zafyrepaySection) zafyrepaySection.classList.remove('hidden');
        if (zafyrecreatorsSection) zafyrecreatorsSection.classList.remove('hidden');
        if (creatorBadge) creatorBadge.classList.remove('hidden');

        // Atualizar display de saldo ZafyrePay
        const walletBalanceDisplay = document.getElementById('wallet-balance-display');
        const walletZafyrecoinsDisplay = document.getElementById('wallet-zafyrecoins-display');
        if (walletBalanceDisplay) {
            const realValue = (userProfile.zafyreCoins || 0) * 0.05;
            walletBalanceDisplay.textContent = `R$ ${realValue.toFixed(2)}`;
        }
        if (walletZafyrecoinsDisplay) {
            walletZafyrecoinsDisplay.textContent = userProfile.zafyreCoins || 0;
        }
    } else {
        if (payoutButton) payoutButton.classList.add('hidden');
        if (zafyrepaySection) zafyrepaySection.classList.add('hidden');
        if (zafyrecreatorsSection) zafyrecreatorsSection.classList.add('hidden');
        if (creatorBadge) creatorBadge.classList.add('hidden');
    }

    const premiumStatusElement = document.getElementById('profile-premium-status');
    if (premiumStatusElement) {
        if (userProfile.isPremium) {
            const expiryDate = userProfile.premiumExpires ? new Date(userProfile.premiumExpires.toDate()).toLocaleDateString() : 'Nunca';
            premiumStatusElement.textContent = `Premium Ativo (expira em: ${expiryDate})`;
            premiumStatusElement.style.color = 'var(--primary-color)';
        } else {
            premiumStatusElement.textContent = 'Não é Premium';
            premiumStatusElement.style.color = 'var(--text-color-light)';
        }
    }

    const navProfilePic = document.getElementById('nav-profile-pic');
    const navUsername = document.getElementById('nav-username');
    if (navProfilePic) navProfilePic.src = userProfile.profilePictureUrl || userProfile.profilePicture || 'https://via.placeholder.com/40';
    if (navUsername) navUsername.textContent = userProfile.username || 'Perfil';
}

function loadDailyLimits() {
    const savedLimits = localStorage.getItem('dailyLimits');
    const today = new Date().toDateString();

    if (savedLimits) {
        const data = JSON.parse(savedLimits);
        if (data.date === today) {
            dailySwipeCount = data.dailySwipeCount;
            dailyMessageCounts = data.dailyMessageCounts;
            lastDailyResetDate = data.date;
        } else {
            resetDailyLimits();
        }
    } else {
        resetDailyLimits();
    }
}

function saveDailyLimits() {
    const today = new Date().toDateString();
    const dataToSave = {
        date: today,
        dailySwipeCount: dailySwipeCount,
        dailyMessageCounts: dailyMessageCounts
    };
    localStorage.setItem('dailyLimits', JSON.stringify(dataToSave));
}

function clearPostFields() {
    // Limpar campo de texto do post
    const postTextArea = document.getElementById('post-text');
    if (postTextArea) {
        postTextArea.value = '';
    }

    // Limpar input de imagem
    const postImageInput = document.getElementById('post-image');
    if (postImageInput) {
        postImageInput.value = '';
    }

    // Limpar preview da imagem
    const imagePreview = document.getElementById('image-preview');
    if (imagePreview) {
        imagePreview.classList.add('hidden');
        imagePreview.src = '';
    }

    // Limpar campos do PPV se existirem
    const ppvTitle = document.getElementById('ppv-title');
    const ppvPrice = document.getElementById('ppv-price');
    const ppvUploadFile = document.getElementById('ppv-upload-file');
    const ppvImagePreview = document.getElementById('ppv-image-preview');
    const ppvVideoPreview = document.getElementById('ppv-video-preview');

    if (ppvTitle) ppvTitle.value = '';
    if (ppvPrice) ppvPrice.value = '';
    if (ppvUploadFile) ppvUploadFile.value = '';
    if (ppvImagePreview) {
        ppvImagePreview.classList.add('hidden');
        ppvImagePreview.src = '';
    }
    if (ppvVideoPreview) {
        ppvVideoPreview.classList.add('hidden');
        ppvVideoPreview.src = '';
    }

    // Limpar campos de edição de perfil
    const editUsername = document.getElementById('edit-username');
    const editBio = document.getElementById('edit-bio');
    const editAge = document.getElementById('edit-age');
    const editLocation = document.getElementById('edit-location');
    const editInterests = document.getElementById('edit-interests');
    const profilePicUpload = document.getElementById('profile-pic-upload');

    if (editUsername) editUsername.value = '';
    if (editBio) editBio.value = '';
    if (editAge) editAge.value = '';
    if (editLocation) editLocation.value = '';
    if (editInterests) editInterests.value = '';
    if (profilePicUpload) profilePicUpload.value = '';

    // Limpar campo de mensagem do chat
    const messageInput = document.getElementById('chat-message-input');
    if (messageInput) {
        messageInput.value = '';
    }

    // Limpar inputs de mídia do chat
    const chatImageInput = document.getElementById('chat-image-input');
    const chatAudioInput = document.getElementById('chat-audio-input');
    if (chatImageInput) chatImageInput.value = '';
    if (chatAudioInput) chatAudioInput.value = '';

    console.log('Campos de formulários limpos após troca de usuário');
}

function resetDailyLimits() {
    dailySwipeCount = 0;
    dailyMessageCounts = {};
    lastDailyResetDate = new Date().toDateString();
    saveDailyLimits();
}

// --- Inicialização do Firebase e Autenticação ---

// Inicializar Firebase quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicialize o Firebase apenas uma vez
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        auth = firebase.auth();
        db = firebase.firestore();

        console.log('Firebase inicializado com sucesso');

        // Configurar listener de autenticação
        auth.onAuthStateChanged(async (user) => {
            console.log('Estado de autenticação mudou:', user ? user.uid : 'nenhum usuário');

            if (user) {
                currentUser = user;
                console.log('Usuário logado:', currentUser.uid);

                try {
                    const userDocRef = db.collection('users').doc(currentUser.uid);
                    const doc = await userDocRef.get();

                    if (doc.exists) {
                        userProfile = doc.data();
                        console.log('Perfil do usuário carregado:', userProfile);
                        updateProfileUI();
                        loadDailyLimits();
                        loadFollowingList();
                        clearPostFields(); // Limpar campos de criação de post

                        // Mostrar seção do feed após login bem-sucedido
                        setTimeout(() => {
                            showSection('feed-section');
                        }, 500);
                    } else {
                        console.log('Perfil não existe, redirecionando para setup');
                        showSection('auth-section');
                        showToast('Complete seu perfil para continuar', 'warning');
                    }
                } catch (error) {
                    console.error('Erro ao carregar perfil:', error);
                    showToast('Erro ao carregar perfil do usuário', 'error');
                }
            } else {
                currentUser = null;
                userProfile = {};
                clearPostFields(); // Limpar campos quando sair da conta
                console.log('Nenhum usuário logado.');
                showSection('auth-section');
            }
        });

        // Configurar event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        showToast('❌ Erro ao conectar com o servidor. Verifique sua conexão.', 'error');
    }
});

function setupEventListeners() {
    // Event Listeners de Autenticação
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');

    if (registerForm) registerForm.addEventListener('submit', handleSignUp);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    // Links de alternância entre login e registro
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('register-section').classList.remove('hidden');
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-section').classList.add('hidden');
            document.getElementById('login-section').classList.remove('hidden');
        });
    }

    // Botões de navegação
    const navFeed = document.getElementById('nav-feed');
    const navSwipe = document.getElementById('nav-swipe');
    const navChat = document.getElementById('nav-chat');
    const navProfile = document.getElementById('nav-profile');

    if (navFeed) navFeed.addEventListener('click', () => showSection('feed-section'));
    if (navSwipe) navSwipe.addEventListener('click', () => showSection('swipe-section'));
    if (navChat) navChat.addEventListener('click', () => showSection('chat-section'));
    if (navProfile) navProfile.addEventListener('click', () => showSection('profile-section'));

    // Event listeners de posts
    const submitPostBtn = document.getElementById('submit-post');
    const postImageInput = document.getElementById('post-image');

    if (submitPostBtn) submitPostBtn.addEventListener('click', createPost);
    if (postImageInput) postImageInput.addEventListener('change', previewPostImage);

    // Event listeners de perfil
    const editProfileBtn = document.getElementById('edit-profile-button');
    const closeEditModal = document.getElementById('close-edit-profile-modal');
    const editProfileForm = document.getElementById('edit-profile-form');
    const profilePicUpload = document.getElementById('profile-pic-upload');

    if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);
    if (closeEditModal) closeEditModal.addEventListener('click', closeEditProfileModal);
    if (editProfileForm) editProfileForm.addEventListener('submit', saveProfileChanges);
    if (profilePicUpload) profilePicUpload.addEventListener('change', uploadProfilePicture);

    // Event listeners de chat
    const backToChatBtn = document.getElementById('back-to-chats-button');
    const sendMessageBtn = document.getElementById('send-chat-message');
    const messageInput = document.getElementById('chat-message-input');
    const chatImageInput = document.getElementById('chat-image-input');
    const chatAudioInput = document.getElementById('chat-audio-input');

    if (backToChatBtn) {
        backToChatBtn.addEventListener('click', () => {
            document.getElementById('chat-conversation-modal').classList.add('hidden');
            if (unsubscribeFromMessages) {
                unsubscribeFromMessages();
                unsubscribeFromMessages = null;
            }
        });
    }

    if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendChatMessage);
    if (messageInput) messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    if (chatImageInput) chatImageInput.addEventListener('change', (e) => sendChatMedia(e.target.files[0], 'image'));
    if (chatAudioInput) chatAudioInput.addEventListener('change', (e) => sendChatMedia(e.target.files[0], 'audio'));

    // Event listeners do ZafyreCreators
    const submitPpvBtn = document.getElementById('submit-ppv');
    const ppvUploadFile = document.getElementById('ppv-upload-file');
    const requestPayoutBtn = document.getElementById('request-payout-button');

    if (submitPpvBtn) submitPpvBtn.addEventListener('click', uploadPpvContent);
    if (ppvUploadFile) ppvUploadFile.addEventListener('change', previewPpvContent);
    if (requestPayoutBtn) requestPayoutBtn.addEventListener('click', requestPayout);

    console.log('Event listeners configurados');
}

async function handleSignUp(event) {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const gender = document.getElementById('register-gender').value;
    const username = document.getElementById('register-username').value;
    const age = parseInt(document.getElementById('register-age').value);

    if (password !== confirmPassword) {
        showToast('❌ As senhas não coincidem!', 'error');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await db.collection('users').doc(user.uid).set({
            email: user.email,
            username: username || `Usuário_${user.uid.substring(0, 6)}`,
            gender: gender,
            profilePicture: '',
            profilePictureUrl: '',
            bio: document.getElementById('register-bio').value || '',
            age: age || null,
            location: document.getElementById('register-location').value || '',
            interests: document.getElementById('register-interests').value ? 
                       document.getElementById('register-interests').value.split(',').map(i => i.trim()).filter(i => i) : [],
            zafyreCoins: 0,
            isPremium: false,
            premiumExpires: null,
            posts: 0,
            followers: 0,
            following: 0,
            isCreator: gender === 'Feminino',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('✅ Cadastro e perfil criados com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showToast(`❌ Erro no cadastro: ${error.message}`, 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        console.log('Tentando fazer login...');
        await auth.signInWithEmailAndPassword(email, password);
        showToast('✅ Login realizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no login:', error);
        showToast(`❌ Erro no login: ${error.message}`, 'error');
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showToast('👋 Deslogado com sucesso!', 'info');
    } catch (error) {
        console.error('Erro ao deslogar:', error);
        showToast(`❌ Erro ao deslogar: ${error.message}`, 'error');
    }
}

// --- Sistema de Feed ---
async function loadFeed() {
    try {
        const postsQuery = db.collection('posts')
            .orderBy('timestamp', 'desc')
            .limit(20);

        const snapshot = await postsQuery.get();
        const postsContainer = document.getElementById('posts-container');
        if (!postsContainer) return;

        postsContainer.innerHTML = '';

        for (const doc of snapshot.docs) {
            const post = doc.data();
            const userDoc = await db.collection('users').doc(post.userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const postElement = createPostElement(doc.id, post, userData);
                postsContainer.appendChild(postElement);
            }
        }

    } catch (error) {
        console.error('Erro ao carregar feed:', error);
        showToast('❌ Erro ao carregar o feed.', 'error');
    }
}

function createPostElement(postId, post, userData) {
    const div = document.createElement('div');
    div.className = 'post-item';

    const timestamp = post.timestamp ?
        new Date(post.timestamp.seconds * 1000).toLocaleString() : '';

    // Verificação rigorosa: apenas o autor do post pode editar/excluir
    const isCurrentUserPost = currentUser && post.userId && post.userId === currentUser.uid;
    
    // Verificar se é conteúdo PPV e se o usuário tem acesso
    const isPpvContent = post.isPpv || false;
    const hasAccess = checkPpvAccess(post, userData);

    const postActionsMenu = isCurrentUserPost ? `
        <div class="post-options-menu" style="position: relative;">
            <button class="options-btn" onclick="togglePostOptions('${postId}')" style="background: none; border: none; color: var(--secondary-text-color); cursor: pointer; padding: 5px;"><i class="fas fa-ellipsis-h"></i></button>
            <div id="post-options-${postId}" class="options-dropdown-content hidden" style="position: absolute; right: 0; top: 100%; background: var(--card-background); border: 1px solid var(--border-color); border-radius: 8px; min-width: 120px; z-index: 100; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                <a href="#" onclick="editPost('${postId}', '${encodeURIComponent(post.content || '')}', '${encodeURIComponent(post.imageUrl || '')}')" style="display: block; padding: 10px 15px; color: var(--text-color); text-decoration: none; border-bottom: 1px solid var(--border-color-light);"><i class="fas fa-edit"></i> Editar</a>
                <a href="#" onclick="deletePost('${postId}')" style="display: block; padding: 10px 15px; color: var(--error-color); text-decoration: none;"><i class="fas fa-trash"></i> Excluir</a>
            </div>
        </div>
    ` : '';

    const isFollowing = checkIfFollowing(userData.uid);
    const followButtonHtml = userData.uid !== currentUser.uid ? `
        <button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="toggleFollow('${userData.uid}')" style="background: ${isFollowing ? 'var(--border-color)' : 'var(--primary-color)'}; color: ${isFollowing ? 'var(--text-color)' : 'var(--secondary-color)'}; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.8em; cursor: pointer;">
            ${isFollowing ? 'Seguindo' : 'Seguir'}
        </button>
    ` : '';

    div.innerHTML = `
        <div class="post-header">
            <img src="${userData.profilePictureUrl || userData.profilePicture || 'https://via.placeholder.com/45'}"
                 alt="${userData.username}" class="post-avatar" onclick="openUserProfile('${userData.uid}')">
            <div class="post-user-info">
                <div class="post-username" onclick="openUserProfile('${userData.uid}')">
                    ${userData.username}
                    ${userData.isCreator ? '<i class="fas fa-crown" style="color: var(--creator-color); margin-left: 5px;"></i>' : ''}
                </div>
                <div class="post-timestamp">${timestamp}</div>
            </div>
            ${followButtonHtml}
            ${postActionsMenu}
        </div>

        <div class="post-content">
            ${post.content ? `<p>${post.content}</p>` : ''}
            ${post.imageUrl ? renderPpvImage(post, hasAccess) : ''}
            ${isPpvContent && !hasAccess ? renderPpvPurchaseButton(postId, post) : ''}
        </div>

        <div class="post-actions">
            <button class="post-action-btn" onclick="toggleLikePost('${postId}')">
                <i class="fas fa-heart ${userProfile.likedPosts && userProfile.likedPosts.includes(postId) ? 'liked' : ''}"></i> <span id="likes-${postId}">${post.likes || 0}</span>
            </button>
            <button class="post-action-btn" onclick="showComments('${postId}')">
                <i class="fas fa-comment"></i> <span id="comments-count-${postId}">${post.comments || 0}</span>
            </button>
            <button class="post-action-btn" onclick="sharePost('${postId}')">
                <i class="fas fa-share"></i> Compartilhar
            </button>
        </div>
    `;

    const optionsBtn = div.querySelector('.options-btn');
    if (optionsBtn) {
        optionsBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            togglePostOptions(postId);
        });
    }

    return div;
}

// --- Funções auxiliares que serão usadas pelos event handlers ---

function previewPostImage(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        preview.classList.add('hidden');
        preview.src = '';
    }
}

async function createPost() {
    const content = document.getElementById('post-text').value.trim();
    const imageInput = document.getElementById('post-image');
    const imageFile = imageInput.files[0];

    if (!content && !imageFile) {
        showToast('❌ Escreva algo ou adicione uma imagem!', 'error');
        return;
    }

    if (!currentUser) {
        showToast('❌ Você precisa estar logado para publicar!', 'error');
        return;
    }

    try {
        let imageUrl = '';

        if (imageFile) {
            if (!imageFile.type.startsWith('image/')) {
                showToast('❌ Por favor, selecione apenas arquivos de imagem!', 'error');
                return;
            }
            if (imageFile.size > 10 * 1024 * 1024) {
                showToast('❌ Imagem muito grande! Máximo 10MB.', 'error');
                return;
            }

            showToast('📤 Fazendo upload da imagem do post...', 'info');
            try {
                imageUrl = await uploadToCloudinary(imageFile, 'posts');
                showToast('✅ Imagem do post carregada com sucesso!', 'success');
            } catch (uploadError) {
                console.error('Erro no upload da imagem do post:', uploadError);
                showToast('❌ Erro ao fazer upload da imagem. Publicando apenas o texto.', 'warning');
                imageUrl = '';
            }
        }

        const postData = {
            userId: currentUser.uid,
            content: content,
            imageUrl: imageUrl,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            comments: 0,
            shares: 0,
            authorName: userProfile?.username || 'Usuário',
            authorPicture: userProfile?.profilePictureUrl || userProfile?.profilePicture || '',
            isCreator: userProfile?.isCreator || false
        };

        showToast('📝 Publicando post...', 'info');
        await db.collection('posts').add(postData);

        if (userProfile) {
            await db.collection('users').doc(currentUser.uid).update({
                posts: firebase.firestore.FieldValue.increment(1)
            });
            userProfile.posts = (userProfile.posts || 0) + 1;
            updateProfileUI();
        }

        document.getElementById('post-text').value = '';
        imageInput.value = '';
        document.getElementById('image-preview').classList.add('hidden');
        document.getElementById('image-preview').src = '';

        showToast('✅ Post publicado com sucesso!', 'success');
        setTimeout(() => {
            loadFeed();
        }, 1000);

    } catch (error) {
        console.error('Erro ao criar post:', error);
        showToast('❌ Erro ao publicar post. Tente novamente.', 'error');
    }
}

// --- Upload para Cloudinary ---
async function uploadToCloudinary(file, folder = 'misc') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', CLOUDINARY_CONFIG.folder[folder] || CLOUDINARY_CONFIG.folder.posts);
    formData.append('public_id', `${currentUser.uid}_${folder}_${Date.now()}`);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro de upload Cloudinary API:', errorData);
            throw new Error(`Erro no upload Cloudinary: ${errorData.error ? errorData.error.message : response.statusText}`);
        }

        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Erro no upload Cloudinary:', error);
        throw error;
    }
}

// --- Sistema de Descoberta (Explore) ---

let currentExploreProfile = null;
let exploredUserIds = [];

// Event listeners dos botões de swipe serão adicionados dinamicamente na função loadNextExploreProfile

async function loadNextExploreProfile() {
    if (!currentUser) {
        showToast('Você precisa estar logado para explorar perfis!', 'error');
        return;
    }

    if (!userProfile || !userProfile.gender) {
        showToast('❌ Erro: dados do perfil não carregados. Tente novamente.', 'error');
        return;
    }

    if (dailySwipeCount >= DAILY_FREE_SWIPES && !userProfile.isPremium) {
        showSwipeLimitModal();
        return;
    }

    // Inicializar os botões se ainda não existirem
    if (!document.getElementById('explore-like-button')) {
        const swipeContainer = document.querySelector('.swipe-container');
        if (swipeContainer) {
            const swipeCardsArea = swipeContainer.querySelector('.swipe-cards-area') || document.createElement('div');
            swipeCardsArea.className = 'swipe-cards-area';
            swipeCardsArea.id = 'swipe-cards-container';
            swipeCardsArea.innerHTML = '<div id="explore-profile-card" class="swipe-card"><p>Carregando perfis...</p></div>';
            
            const swipeButtons = swipeContainer.querySelector('.swipe-buttons') || document.createElement('div');
            swipeButtons.className = 'swipe-buttons';
            swipeButtons.innerHTML = `
                <button class="swipe-btn dislike-btn" id="explore-dislike-button"><i class="fas fa-times"></i></button>
                <button class="swipe-btn superlike-btn" id="explore-superlike-button"><i class="fas fa-star"></i></button>
                <button class="swipe-btn like-btn" id="explore-like-button"><i class="fas fa-heart"></i></button>
            `;
            
            if (!swipeContainer.querySelector('.swipe-cards-area')) {
                swipeContainer.appendChild(swipeCardsArea);
            }
            if (!swipeContainer.querySelector('.swipe-buttons')) {
                swipeContainer.appendChild(swipeButtons);
            }
            
            // Adicionar event listeners
            const likeButton = document.getElementById('explore-like-button');
            const dislikeButton = document.getElementById('explore-dislike-button');
            const superlikeButton = document.getElementById('explore-superlike-button');

            if(likeButton){
                likeButton.addEventListener('click', () => handleExploreSwipe('like'));
            }
            if(dislikeButton){
                dislikeButton.addEventListener('click', () => handleExploreSwipe('dislike'));
            }
            if(superlikeButton){
                superlikeButton.addEventListener('click', () => handleExploreSwipe('superlike'));
            }
        }
    }

    try {
        // Obter IDs dos usuários que já foram "swipados" pelo usuário atual
        const userSwipesDoc = await db.collection('userSwipes').doc(currentUser.uid).get();
        const swipedUsers = userSwipesDoc.exists ? userSwipesDoc.data().swipedUsers || [] : [];

        // Definir qual gênero mostrar baseado no gênero do usuário atual
        let targetGender;
        if (userProfile.gender === 'Masculino') {
            targetGender = 'Feminino'; // Homens veem mulheres
        } else if (userProfile.gender === 'Feminino') {
            targetGender = 'Masculino'; // Mulheres veem homens
        } else {
            // Para outros gêneros, mostrar tanto masculino quanto feminino
            targetGender = ['Masculino', 'Feminino'];
        }

        let query;
        if (Array.isArray(targetGender)) {
            query = db.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), '!=', currentUser.uid)
                .where('gender', 'in', targetGender)
                .limit(10);
        } else {
            query = db.collection('users')
                .where(firebase.firestore.FieldPath.documentId(), '!=', currentUser.uid)
                .where('gender', '==', targetGender)
                .limit(10);
        } 

        // Filtra para não mostrar usuários já swipados nesta sessão ou anteriormente
        const combinedExclusions = [...new Set([...swipedUsers, ...exploredUserIds])];
        if (combinedExclusions.length > 0 && combinedExclusions.length <= 10) {
            // Firestore permite no máximo 10 itens no 'not-in'
            if (Array.isArray(targetGender)) {
                query = query.where(firebase.firestore.FieldPath.documentId(), 'not-in', combinedExclusions);
            } else {
                query = query.where(firebase.firestore.FieldPath.documentId(), 'not-in', combinedExclusions);
            }
        }

        const snapshot = await query.get();
        const profiles = [];
        snapshot.forEach(doc => {
            profiles.push({ uid: doc.id, ...doc.data() });
        });

        console.log(`Buscando perfis para usuário ${userProfile.gender}. Target gender: ${targetGender}. Encontrados: ${profiles.length} perfis`);

        if (profiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * profiles.length);
            currentExploreProfile = profiles[randomIndex];
            exploredUserIds.push(currentExploreProfile.uid); // Adiciona ao array de explorados da sessão

            console.log(`Perfil selecionado para exploração:`, currentExploreProfile);
            updateExploreProfileUI(currentExploreProfile);
        } else {
            const exploreProfileCard = document.getElementById('explore-profile-card');
            if(exploreProfileCard){
                exploreProfileCard.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <h3>Nenhum novo perfil encontrado.</h3>
                        <p>Tente novamente mais tarde ou ajuste seus filtros.</p>
                        <button onclick="resetExploreProfiles()" style="margin-top: 15px; padding: 10px 20px; background-color: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Reiniciar Perfis
                        </button>
                    </div>
                `;
            }
            currentExploreProfile = null;
            showToast('Nenhum novo perfil encontrado.', 'info');
        }

    } catch (error) {
        console.error('Erro ao carregar perfil de exploração:', error);
        showToast('❌ Erro ao carregar perfis. Tente novamente.', 'error');
    }
}

function resetExploreProfiles() {
    exploredUserIds = [];
    loadNextExploreProfile();
    showToast('Perfis de exploração reiniciados!', 'info');
}

function updateExploreProfileUI(profile) {
    let card = document.getElementById('explore-profile-card');
    if (!card) {
        const container = document.getElementById('swipe-cards-container');
        if (container) {
            container.innerHTML = '<div id="explore-profile-card" class="swipe-card"></div>';
            card = document.getElementById('explore-profile-card');
        }
    }
    
    if (!profile) {
        if(card){
            card.innerHTML = `<p style="text-align: center; padding: 20px;">Carregando perfis...</p>`;
        }
        return;
    }

    // Tratar interests como array ou string
    let interestsText = 'Nenhum';
    if (profile.interests) {
        if (Array.isArray(profile.interests) && profile.interests.length > 0) {
            interestsText = profile.interests.join(', ');
        } else if (typeof profile.interests === 'string' && profile.interests.trim()) {
            interestsText = profile.interests;
        }
    }

    if(card){
        // Verificar se é criadora (gênero feminino)
        const isCreator = profile.gender === 'Feminino';
        
        card.innerHTML = `
            <img src="${profile.profilePictureUrl || profile.profilePicture || 'https://via.placeholder.com/300x400'}" alt="${profile.username}" class="swipe-card-image">
            <div class="swipe-card-info">
                <div class="swipe-card-name">
                    ${profile.username}, ${profile.age || '?'}
                    ${isCreator ? '<i class="fas fa-crown" style="color: var(--creator-color); margin-left: 5px;" title="Criadora"></i>' : ''}
                </div>
                <div class="swipe-card-details">
                    <p><i class="fas fa-map-marker-alt"></i> ${profile.location || 'Localização não informada'}</p>
                    <p><i class="fas fa-user"></i> ${profile.bio || 'Sem biografia.'}</p>
                    <p><i class="fas fa-heart"></i> Interesses: ${interestsText}</p>
                    ${isCreator ? '<p style="color: var(--creator-color); font-weight: bold;"><i class="fas fa-star"></i> Criadora de Conteúdo</p>' : ''}
                </div>
            </div>
        `;
    }
}

async function handleExploreSwipe(action) {
    if (!currentExploreProfile) {
        showToast('Nenhum perfil para interagir.', 'warning');
        return;
    }

    const targetUserId = currentExploreProfile.uid;

    if (!userProfile.isPremium) {
        if (dailySwipeCount >= DAILY_FREE_SWIPES) {
            showSwipeLimitModal();
            return;
        }
        dailySwipeCount++;
        saveDailyLimits();
    }

    showToast(`Você ${action === 'like' ? 'curtiu' : action === 'superlike' ? 'super curtiu' : action === 'dislike' ? 'descartou' : 'pulou'} ${currentExploreProfile.username}!`, 'info');

    try {
        await saveSwipe(targetUserId, action);

        if (action === 'like' || action === 'superlike') {
            const isMatch = await checkForMatch(targetUserId);
            if (isMatch) {
                showMatchModal(currentExploreProfile);
                showToast(`🎉 É UM MATCH com ${currentExploreProfile.username}!`, 'success');
            }
        }

    } catch (error) {
        console.error('Erro ao processar swipe:', error);
        showToast('❌ Erro ao registrar sua ação.', 'error');
    }

    loadNextExploreProfile();
}

function showSwipeLimitModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Limite de Swipes Atingido</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <p>Você atingiu o limite de ${DAILY_FREE_SWIPES} swipes diários gratuitos.</p>
                <div style="margin: 20px 0; display: flex; gap: 15px; justify-content: center;">
                    <button onclick="buyExtraSwipes();"
                            style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-coins"></i> Comprar +5 Swipes (50 ZafyreCoins)
                    </button>
                    <button onclick="watchAdsForSwipes();"
                            style="background: var(--accent-color); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-play"></i> Assistir Anúncio (+1 Swipe)
                    </button>
                </div>
                <p style="color: var(--primary-color); font-weight: 600; margin-top: 15px;">
                    Ou assine o Premium para swipes ilimitados!
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function buyExtraSwipes() {
    if (userProfile.zafyreCoins >= 50) {
        db.collection('users').doc(currentUser.uid).update({
            zafyreCoins: firebase.firestore.FieldValue.increment(-50)
        }).then(() => {
            userProfile.zafyreCoins = (userProfile.zafyreCoins || 0) - 50;
            showToast('✅ +5 swipes adicionados! (50 ZafyreCoins debitados)', 'success');
            dailySwipeCount = Math.max(0, dailySwipeCount - 5);
            saveDailyLimits();
            updateProfileUI();
            document.querySelector('.modal').remove(); // Fecha o modal
        }).catch(error => {
            console.error('Erro ao debitar ZafyreCoins para swipes:', error);
            showToast('❌ Erro ao processar compra de swipes', 'error');
        });
    } else {
        showToast('❌ ZafyreCoins insuficientes. Compre mais na ZafyreShop!', 'error');
        showInsufficientCoinsModal('swipes');
    }
}

function watchAdsForSwipes() {
    showToast('📺 Função de anúncios para swipes será implementada em breve!', 'info');
    document.querySelector('.modal').remove();
}

async function saveSwipe(targetUserId, action) {
    try {
        const swipeData = {
            swiperId: currentUser.uid,
            targetId: targetUserId,
            action: action,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('swipes').add(swipeData);

        const userSwipesRef = db.collection('userSwipes').doc(currentUser.uid);
        await userSwipesRef.set({
            swipedUsers: firebase.firestore.FieldValue.arrayUnion(targetUserId)
        }, { merge: true });

    } catch (error) {
        console.error('Erro ao salvar swipe:', error);
    }
}

async function checkForMatch(targetUserId) {
    try {
        const query = db.collection('swipes')
            .where('swiperId', '==', targetUserId)
            .where('targetId', '==', currentUser.uid)
            .where('action', 'in', ['like', 'superlike']);

        const snapshot = await query.get();

        if (!snapshot.empty) {
            let chatId = null;
            const existingChats = await db.collection('chats')
                .where('participants', 'array-contains', currentUser.uid)
                .get();

            existingChats.forEach(doc => {
                const participants = doc.data().participants;
                if (participants.includes(targetUserId)) {
                    chatId = doc.id;
                }
            });

            if (!chatId) {
                chatId = await createChat(targetUserId);
                console.log(`Novo chat criado para match: ${chatId}`);
            } else {
                console.log(`Chat existente encontrado para match: ${chatId}`);
            }
            return true;
        }

        return false;
    } catch (error) {
        console.error('Erro ao verificar match:', error);
        return false;
    }
}

function showMatchModal(profile) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="text-align: center;">
            <div style="color: var(--primary-color); font-size: 3em; margin-bottom: 20px;">
                💖 MATCH! 💖
            </div>
            <img src="${profile.profilePictureUrl || profile.profilePicture || 'https://via.placeholder.com/100'}"
                 style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 15px;">
            <h3>Você e ${profile.username} se curtiram!</h3>
            <p>Que tal começar uma conversa?</p>
            <div style="margin-top: 25px; display: flex; gap: 15px; justify-content: center;">
                <button onclick="this.closest('.modal').remove();"
                        style="background: var(--border-color); color: var(--text-color); border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                    Depois
                </button>
                <button onclick="startChatWithMatch('${profile.uid}');"
                        style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-comment"></i> Conversar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function startChatWithMatch(userId) {
    let chatId = null;
    const existingChats = await db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .get();

    existingChats.forEach(doc => {
        const participants = doc.data().participants;
        if (participants.includes(userId)) {
            chatId = doc.id;
        }
    });

    if (!chatId) {
        chatId = await createChat(userId);
    }

    if (chatId) {
        const partnerDoc = await db.collection('users').doc(userId).get();
        if (partnerDoc.exists) {
            openChat(chatId, partnerDoc.data());
            showSection('chat-section');
            document.getElementById('chat-conversation-modal').classList.remove('hidden');
        } else {
            console.error("Perfil do parceiro de chat não encontrado.");
            showToast('Erro ao iniciar chat: perfil não encontrado.', 'error');
        }
    } else {
        showToast('Erro ao iniciar chat.', 'error');
    }
    document.querySelector('.modal').remove(); // Fecha o modal de match
}

// --- Sistema de Chat ---

async function loadChats() {
    try {
        const chatsQuery = db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .orderBy('lastMessageTimestamp', 'desc');

        const snapshot = await chatsQuery.get();
        const chatsList = document.getElementById('chat-list-container');
        const noChatMessage = document.getElementById('no-chats-message');

        if (snapshot.empty) {
            noChatMessage.classList.remove('hidden');
            chatsList.innerHTML = '';
            return;
        }

        noChatMessage.classList.add('hidden');
        chatsList.innerHTML = '';

        const chatPromises = snapshot.docs.map(async doc => {
            const chat = doc.data();
            const partnerId = chat.participants.find(id => id !== currentUser.uid);
            const partnerDoc = await db.collection('users').doc(partnerId).get();
            if (partnerDoc.exists) {
                return { id: doc.id, chat, partner: partnerDoc.data() };
            }
            return null;
        });

        const chatsWithPartners = (await Promise.all(chatPromises)).filter(Boolean);

        chatsWithPartners.forEach(({ id, chat, partner }) => {
            const chatElement = createChatListItem(id, chat, partner);
            chatsList.appendChild(chatElement);
        });

    } catch (error) {
        console.error('Erro ao carregar lista de chats:', error);
        showToast('❌ Erro ao carregar chats.', 'error');
    }
}

function createChatListItem(chatId, chat, partner) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat(chatId, partner);

    const lastMessage = chat.lastMessage || 'Iniciar conversa...';
    const timestamp = chat.lastMessageTimestamp && chat.lastMessageTimestamp.seconds ?
        new Date(chat.lastMessageTimestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    div.innerHTML = `
        <img src="${partner.profilePictureUrl || partner.profilePicture || 'https://via.placeholder.com/50'}"
             alt="${partner.username}" class="chat-avatar">
        <div class="chat-info">
            <div class="chat-name">
                ${partner.username}
                ${partner.isCreator ? '<i class="fas fa-crown" style="color: var(--creator-color); margin-left: 5px;"></i>' : ''}
            </div>
            <div class="chat-last-message">${lastMessage}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: end;">
            <div class="chat-time">${timestamp}</div>
            ${chat.unreadCount > 0 ? `<div class="message-count-badge">${chat.unreadCount}</div>` : ''}
        </div>
    `;

    return div;
}

async function createChat(partnerId) {
    try {
        const chatData = {
            participants: [currentUser.uid, partnerId],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: '',
            lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            messageCount: 0,
            mutualFollow: false // Pode ser atualizado se a lógica de follow mútuo for implementada
        };

        const chatRef = await db.collection('chats').add(chatData);
        console.log(`Chat criado com ID: ${chatRef.id}`);
        loadChats();
        return chatRef.id;
    } catch (error) {
        console.error('Erro ao criar chat:', error);
        showToast('❌ Erro ao criar chat.', 'error');
        return null;
    }
}

function openChat(chatId, partner) {
    if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
    }

    currentChatId = chatId;
    currentChatPartner = partner;

    const chatPartnerAvatar = document.querySelector('.chat-partner-avatar');
    const chatPartnerName = document.querySelector('.chat-partner-name');

    if(chatPartnerAvatar){
        chatPartnerAvatar.src = partner.profilePictureUrl || partner.profilePicture || 'https://via.placeholder.com/40';
    }
    if(chatPartnerName){
        chatPartnerName.textContent = partner.username;
    }

    loadChatMessagesLive(chatId);

    document.getElementById('chat-conversation-modal').classList.remove('hidden');
}

async function loadChatMessagesLive(chatId) {
    try {
        const messagesQuery = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .limit(50);

        const messagesContainer = document.getElementById('chat-messages-container');
        if(!messagesContainer) return;

        messagesContainer.innerHTML = '';

        unsubscribeFromMessages = messagesQuery.onSnapshot(snapshot => {
            messagesContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const message = doc.data();
                const messageElement = createMessageElement(message);
                messagesContainer.appendChild(messageElement);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, error => {
            console.error('Erro ao carregar mensagens em tempo real:', error);
            showToast('❌ Erro ao carregar mensagens do chat.', 'error');
        });

    } catch (error) {
        console.error('Erro ao configurar listener de mensagens:', error);
    }
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message-bubble ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;

    let content = '';
    if (message.type === 'text') {
        content = message.content;
    } else if (message.type === 'image') {
        content = `<img src="${message.content}" style="max-width: 200px; border-radius: 8px;">`;
    } else if (message.type === 'audio') {
        content = `<audio controls><source src="${message.content}" type="audio/mpeg"></audio>`;
    }

    const timestamp = message.timestamp && message.timestamp.seconds ?
        new Date(message.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    div.innerHTML = `
        ${content}
        <div class="message-time">${timestamp}</div>
    `;

    return div;
}

// --- Funções de PPV e Assinatura ---

function checkPpvAccess(post, authorData) {
    if (!post.isPpv) return true; // Não é PPV, acesso liberado
    if (!currentUser) return false; // Usuário não logado
    if (post.userId === currentUser.uid) return true; // Próprio autor
    
    // Verificar se o usuário comprou este PPV específico
    if (userProfile.purchasedPpv && userProfile.purchasedPpv.includes(post.id)) {
        return true;
    }
    
    // Verificar se tem assinatura ativa da criadora
    if (hasActiveSubscription(post.userId)) {
        return true;
    }
    
    return false;
}

function hasActiveSubscription(creatorId) {
    if (!userProfile.subscriptions) return false;
    
    const subscription = userProfile.subscriptions[creatorId];
    if (!subscription) return false;
    
    const now = new Date();
    const expiryDate = new Date(subscription.expiresAt.seconds * 1000);
    
    return now < expiryDate;
}

function renderPpvImage(post, hasAccess) {
    if (!post.imageUrl) return '';
    
    if (hasAccess) {
        return `<img src="${post.imageUrl}" alt="Post image" class="post-image" onclick="openPostImageModal('${post.imageUrl}')">`;
    } else {
        return `
            <div class="ppv-blurred-container" style="position: relative; cursor: pointer;" onclick="showPpvPurchaseModal('${post.id}', '${post.title}', ${post.ppvPrice})">
                <img src="${post.imageUrl}" alt="Conteúdo PPV" class="post-image ppv-blurred" style="filter: blur(20px); opacity: 0.7;">
                <div class="ppv-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 10px; text-align: center;">
                    <i class="fas fa-lock" style="font-size: 2em; margin-bottom: 10px; color: var(--primary-color);"></i>
                    <h4 style="margin-bottom: 5px;">${post.title || 'Conteúdo Exclusivo'}</h4>
                    <p style="font-size: 1.2em; font-weight: bold; color: var(--primary-color);">R$ ${(post.ppvPrice || 0).toFixed(2)}</p>
                    <p style="font-size: 0.9em; opacity: 0.9;">Clique para desbloquear</p>
                </div>
            </div>
        `;
    }
}

function renderPpvPurchaseButton(postId, post) {
    return `
        <div class="ppv-purchase-section" style="margin-top: 15px; padding: 15px; background: rgba(255, 215, 0, 0.1); border-radius: 10px; border: 1px solid var(--primary-color);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h4 style="color: var(--primary-color); margin-bottom: 5px;">
                        <i class="fas fa-star"></i> Conteúdo Premium
                    </h4>
                    <p style="font-size: 0.9em; color: var(--secondary-text-color);">
                        ${post.title || 'Conteúdo exclusivo da criadora'}
                    </p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.3em; font-weight: bold; color: var(--primary-color);">
                        R$ ${(post.ppvPrice || 0).toFixed(2)}
                    </div>
                    <button onclick="purchasePpv('${postId}', ${post.ppvPrice})" 
                            style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 8px 15px; border-radius: 20px; font-size: 0.9em; cursor: pointer; margin-top: 5px;">
                        <i class="fas fa-unlock"></i> Desbloquear
                    </button>
                </div>
            </div>
        </div>
    `;
}

function showPpvPurchaseModal(postId, title, price) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">💎 Conteúdo Premium</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-lock" style="font-size: 3em; color: var(--primary-color); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px;">${title || 'Conteúdo Exclusivo'}</h3>
                <p style="margin-bottom: 20px; color: var(--secondary-text-color);">
                    Este conteúdo está disponível apenas para assinantes ou mediante pagamento individual.
                </p>
                
                <div style="background: rgba(255, 215, 0, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                    <div style="font-size: 2em; font-weight: bold; color: var(--primary-color); margin-bottom: 10px;">
                        R$ ${price.toFixed(2)}
                    </div>
                    <p style="font-size: 0.9em; color: var(--secondary-text-color);">
                        Acesso vitalício a este conteúdo
                    </p>
                </div>

                <div style="display: flex; gap: 15px; justify-content: center; margin-bottom: 20px;">
                    <button onclick="purchasePpv('${postId}', ${price}); this.closest('.modal').remove();" 
                            style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 12px 20px; border-radius: 25px; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-unlock"></i> Comprar Agora
                    </button>
                    <button onclick="showSubscriptionModal('${postId}'); this.closest('.modal').remove();" 
                            style="background: var(--creator-color); color: white; border: none; padding: 12px 20px; border-radius: 25px; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-crown"></i> Assinar Criadora
                    </button>
                </div>
                
                <p style="font-size: 0.8em; color: var(--secondary-text-color); margin-top: 15px;">
                    💡 Assinando a criadora você tem acesso a TODO o conteúdo dela!
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function purchasePpv(postId, price) {
    if (!currentUser) {
        showToast('❌ Você precisa estar logado para comprar conteúdo PPV!', 'error');
        return;
    }

    const priceInCoins = Math.ceil(price * 20); // 1 real = 20 ZafyreCoins
    
    if ((userProfile.zafyreCoins || 0) < priceInCoins) {
        showToast(`❌ Você precisa de ${priceInCoins} ZafyreCoins para comprar este conteúdo!`, 'error');
        showInsufficientCoinsModal('PPV');
        return;
    }

    if (confirm(`Confirma a compra deste conteúdo PPV por ${priceInCoins} ZafyreCoins (R$ ${price.toFixed(2)})?`)) {
        try {
            // Debitar ZafyreCoins do comprador
            await db.collection('users').doc(currentUser.uid).update({
                zafyreCoins: firebase.firestore.FieldValue.increment(-priceInCoins),
                purchasedPpv: firebase.firestore.FieldValue.arrayUnion(postId)
            });

            // Creditar ZafyreCoins para a criadora
            const postDoc = await db.collection('posts').doc(postId).get();
            if (postDoc.exists) {
                const postData = postDoc.data();
                await db.collection('users').doc(postData.userId).update({
                    zafyreCoins: firebase.firestore.FieldValue.increment(priceInCoins)
                });

                // Registrar venda PPV
                await db.collection('ppvSales').add({
                    buyerId: currentUser.uid,
                    sellerId: postData.userId,
                    postId: postId,
                    price: price,
                    priceInCoins: priceInCoins,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Atualizar perfil local
            userProfile.zafyreCoins = (userProfile.zafyreCoins || 0) - priceInCoins;
            if (!userProfile.purchasedPpv) userProfile.purchasedPpv = [];
            userProfile.purchasedPpv.push(postId);
            
            updateProfileUI();
            showToast('✅ Conteúdo PPV comprado com sucesso!', 'success');
            
            // Recarregar feed para mostrar o conteúdo desbloqueado
            loadFeed();

        } catch (error) {
            console.error('Erro ao comprar PPV:', error);
            showToast('❌ Erro ao processar compra. Tente novamente.', 'error');
        }
    }
}

function showSubscriptionModal(creatorId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">👑 Assinar Criadora</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-crown" style="font-size: 3em; color: var(--creator-color); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 15px;">Acesso Total ao Conteúdo</h3>
                <p style="margin-bottom: 20px; color: var(--secondary-text-color);">
                    Assine para ter acesso ilimitado a TODOS os conteúdos desta criadora!
                </p>
                
                <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="subscription-option" onclick="purchaseSubscription('${creatorId}', 'monthly', 19.99)" 
                         style="background: rgba(255, 62, 150, 0.1); border: 2px solid var(--creator-color); border-radius: 15px; padding: 15px; cursor: pointer;">
                        <div style="font-size: 1.2em; font-weight: bold; color: var(--creator-color);">Mensal</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--text-color);">R$ 19,99</div>
                        <div style="font-size: 0.9em; color: var(--secondary-text-color);">Renovação automática</div>
                    </div>
                    
                    <div class="subscription-option" onclick="purchaseSubscription('${creatorId}', 'quarterly', 49.99)" 
                         style="background: rgba(255, 62, 150, 0.1); border: 2px solid var(--creator-color); border-radius: 15px; padding: 15px; cursor: pointer;">
                        <div style="font-size: 1.2em; font-weight: bold; color: var(--creator-color);">Trimestral</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--text-color);">R$ 49,99</div>
                        <div style="font-size: 0.9em; color: var(--success-color);">Economize 16%</div>
                    </div>
                    
                    <div class="subscription-option" onclick="purchaseSubscription('${creatorId}', 'semiannual', 89.99)" 
                         style="background: rgba(255, 62, 150, 0.1); border: 2px solid var(--creator-color); border-radius: 15px; padding: 15px; cursor: pointer;">
                        <div style="font-size: 1.2em; font-weight: bold; color: var(--creator-color);">Semestral</div>
                        <div style="font-size: 1.5em; font-weight: bold; color: var(--text-color);">R$ 89,99</div>
                        <div style="font-size: 0.9em; color: var(--success-color);">Economize 25%</div>
                    </div>
                </div>
                
                <div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 10px; margin-top: 20px;">
                    <p style="font-size: 0.9em; color: var(--text-color);">
                        ✨ <strong>Vantagens da Assinatura:</strong><br>
                        • Acesso a TODOS os conteúdos PPV<br>
                        • Chat ilimitado com a criadora<br>
                        • Conteúdo exclusivo para assinantes<br>
                        • Sem anúncios na conversa
                    </p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function purchaseSubscription(creatorId, period, price) {
    if (!currentUser) {
        showToast('❌ Você precisa estar logado para assinar!', 'error');
        return;
    }

    const priceInCoins = Math.ceil(price * 20); // 1 real = 20 ZafyreCoins
    
    if ((userProfile.zafyreCoins || 0) < priceInCoins) {
        showToast(`❌ Você precisa de ${priceInCoins} ZafyreCoins para esta assinatura!`, 'error');
        showInsufficientCoinsModal('assinatura');
        return;
    }

    const periodNames = {
        monthly: 'Mensal',
        quarterly: 'Trimestral',
        semiannual: 'Semestral'
    };

    if (confirm(`Confirma a assinatura ${periodNames[period]} por ${priceInCoins} ZafyreCoins (R$ ${price.toFixed(2)})?`)) {
        try {
            // Calcular data de expiração
            const expiryDate = new Date();
            if (period === 'monthly') expiryDate.setMonth(expiryDate.getMonth() + 1);
            else if (period === 'quarterly') expiryDate.setMonth(expiryDate.getMonth() + 3);
            else if (period === 'semiannual') expiryDate.setMonth(expiryDate.getMonth() + 6);

            // Debitar ZafyreCoins do assinante
            await db.collection('users').doc(currentUser.uid).update({
                zafyreCoins: firebase.firestore.FieldValue.increment(-priceInCoins),
                [`subscriptions.${creatorId}`]: {
                    period: period,
                    price: price,
                    startDate: firebase.firestore.FieldValue.serverTimestamp(),
                    expiresAt: firebase.firestore.Timestamp.fromDate(expiryDate)
                }
            });

            // Creditar ZafyreCoins para a criadora
            await db.collection('users').doc(creatorId).update({
                zafyreCoins: firebase.firestore.FieldValue.increment(priceInCoins)
            });

            // Registrar assinatura
            await db.collection('subscriptions').add({
                subscriberId: currentUser.uid,
                creatorId: creatorId,
                period: period,
                price: price,
                priceInCoins: priceInCoins,
                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(expiryDate),
                isActive: true
            });

            // Atualizar perfil local
            userProfile.zafyreCoins = (userProfile.zafyreCoins || 0) - priceInCoins;
            if (!userProfile.subscriptions) userProfile.subscriptions = {};
            userProfile.subscriptions[creatorId] = {
                period: period,
                price: price,
                expiresAt: firebase.firestore.Timestamp.fromDate(expiryDate)
            };
            
            updateProfileUI();
            showToast(`✅ Assinatura ${periodNames[period]} ativada com sucesso!`, 'success');
            
            // Recarregar feed para mostrar conteúdo desbloqueado
            loadFeed();

        } catch (error) {
            console.error('Erro ao processar assinatura:', error);
            showToast('❌ Erro ao processar assinatura. Tente novamente.', 'error');
        }
    }
}

// --- Funções auxiliares que serão implementadas conforme necessário ---

function loadFollowingList() {
    if (!currentUser) {
        followingList = [];
        return;
    }
    try {
        const snapshot = db.collection('follows')
            .where('followerId', '==', currentUser.uid)
            .get();

        snapshot.then(querySnapshot => {
            followingList = querySnapshot.docs.map(doc => doc.data().followingId);
        });
        console.log("Lista de 'seguindo' carregada:", followingList);
    } catch (error) {
        console.error('Erro ao carregar lista de "seguindo":', error);
    }
}

function checkIfFollowing(userId) {
    return followingList.includes(userId);
}

function openEditProfileModal() {
    if (!userProfile) return;

    document.getElementById('edit-username').value = userProfile.username || '';
    document.getElementById('edit-bio').value = userProfile.bio || '';
    document.getElementById('edit-age').value = userProfile.age || '';
    document.getElementById('edit-location').value = userProfile.location || '';
    
    // Tratar interests como array ou string
    let interestsText = '';
    if (userProfile.interests) {
        if (Array.isArray(userProfile.interests)) {
            interestsText = userProfile.interests.join(', ');
        } else if (typeof userProfile.interests === 'string') {
            interestsText = userProfile.interests;
        }
    }
    const editInterestsField = document.getElementById('edit-interests');
    if (editInterestsField) {
        editInterestsField.value = interestsText;
    }

    document.getElementById('edit-profile-modal').classList.remove('hidden');
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

async function saveProfileChanges(e) {
    e.preventDefault();

    try {
        const interestsValue = document.getElementById('edit-interests').value;
        const interestsArray = interestsValue ? interestsValue.split(',').map(i => i.trim()).filter(i => i) : [];
        
        const updatedData = {
            username: document.getElementById('edit-username').value,
            bio: document.getElementById('edit-bio').value,
            age: parseInt(document.getElementById('edit-age').value) || null,
            location: document.getElementById('edit-location').value,
            interests: interestsArray,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(currentUser.uid).update(updatedData);

        Object.assign(userProfile, updatedData);
        updateProfileUI();

        closeEditProfileModal();
        showToast('✅ Perfil atualizado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        showToast('❌ Erro ao atualizar perfil.', 'error');
    }
}

async function uploadProfilePicture(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('❌ Por favor, selecione apenas arquivos de imagem!', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('❌ Imagem muito grande! Máximo 5MB para foto de perfil.', 'error');
        return;
    }

    try {
        showToast('📤 Atualizando foto de perfil no Cloudinary...', 'info');

        const resizedFile = await resizeImage(file, 400, 400, 0.9);

        const downloadURL = await uploadToCloudinary(resizedFile, 'profiles');

        await db.collection('users').doc(currentUser.uid).update({
            profilePictureUrl: downloadURL,
            profilePicture: downloadURL // manter compatibilidade
        });

        userProfile.profilePictureUrl = downloadURL;
        userProfile.profilePicture = downloadURL; // manter compatibilidade
        document.getElementById('profile-pic-display').src = downloadURL;
        document.getElementById('nav-profile-pic').src = downloadURL;

        showToast('✅ Foto de perfil atualizada!', 'success');

    } catch (error) {
        console.error('Erro ao processar/upload foto de perfil:', error);
        showToast('❌ Erro ao atualizar foto de perfil.', 'error');
    } finally {
        e.target.value = '';
    }
}

async function resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = width * (maxHeight / height);
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    } else {
                        reject(new Error("Erro ao redimensionar a imagem para Blob."));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

function sendChatMessage() {
    showToast('💬 Envio de mensagens será implementado em breve!', 'info');
}

async function sendChatMedia(file, type) {
    if (!file || !currentChatId) return;

    const chatDoc = await db.collection('chats').doc(currentChatId).get();
    if (!chatDoc.exists || (chatDoc.data().messageCount || 0) < MINIMUM_MESSAGES_FOR_MEDIA) {
        showMediaUnlockModal();
        return;
    }

    const mediaCost = type === 'image' ? 30 : 20; // Custo de exemplo: Imagem 30 coins, Áudio 20 coins
    if (userProfile.gender === 'Masculino' && !userProfile.isPremium && (userProfile.zafyreCoins || 0) < mediaCost) {
        showInsufficientCoinsModal('mídia');
        return;
    }

    try {
        showToast(`📤 Fazendo upload de ${type}...`, 'info');
        const mediaUrl = await uploadToCloudinary(file, 'chat_media');

        const messageData = {
            senderId: currentUser.uid,
            content: mediaUrl,
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            cost: (userProfile.gender === 'Masculino' && !userProfile.isPremium) ? mediaCost : 0
        };

        await db.collection('chats').doc(currentChatId).collection('messages').add(messageData);

        await db.collection('chats').doc(currentChatId).update({
            lastMessage: `[${type === 'image' ? 'Imagem' : 'Áudio'}]`,
            lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
            messageCount: firebase.firestore.FieldValue.increment(1)
        });

        if (messageData.cost > 0) {
            await db.collection('users').doc(currentUser.uid).update({
                zafyreCoins: firebase.firestore.FieldValue.increment(-messageData.cost)
            });
            userProfile.zafyreCoins = (userProfile.zafyreCoins || 0) - messageData.cost;
            updateWalletDisplay();
        }

        showToast(`✅ ${type === 'image' ? 'Imagem' : 'Áudio'} enviado!`, 'success');
        document.getElementById(`chat-${type}-upload`).value = '';

    } catch (error) {
        console.error(`Erro ao enviar ${type}:`, error);
        showToast(`❌ Erro ao enviar ${type}. Tente novamente.`, 'error');
    }
}

function canSendMessage(partnerId) {
    if (userProfile.isPremium) return true;
    if (userProfile.gender === 'Feminino') return true;

    const dailyCount = dailyMessageCounts[partnerId] || 0;
    return dailyCount < DAILY_FREE_MESSAGES;
}

function calculateMessageCost(partnerId) {
    if (userProfile.gender === 'Feminino') return 0;
    if (userProfile.isPremium) return 0;

    // Se houver uma lógica de "seguidores mútuos" que zere o custo, implemente aqui
    // Ex: if (isFollowingMutually(partnerId)) return 0;
    return MESSAGE_COST;
}

function updateDailyMessageCount(partnerId) {
    if (!dailyMessageCounts[partnerId]) {
        dailyMessageCounts[partnerId] = 0;
    }
    dailyMessageCounts[partnerId]++;
    saveDailyLimits();
}

function showMessageLimitModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Limite de Mensagens Atingido</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <p>Você atingiu o limite de ${DAILY_FREE_MESSAGES} mensagens diárias gratuitas para este usuário.</p>
                <div style="margin: 20px 0; display: flex; gap: 15px; justify-content: center;">
                    <button onclick="buyExtraMessages();"
                            style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-coins"></i> Comprar +10 Mensagens (150 ZafyreCoins)
                    </button>
                    <button onclick="watchAdsForMessages();"
                            style="background: var(--accent-color); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-play"></i> Assistir 5 Anúncios (+5 Mensagens)
                    </button>
                </div>
                <p style="color: var(--primary-color); font-weight: 600; margin-top: 15px;">
                    Ou assine o Premium para chat ilimitado!
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function buyExtraMessages() {
    if (userProfile.zafyreCoins >= 150) {
        db.collection('users').doc(currentUser.uid).update({
            zafyreCoins: firebase.firestore.FieldValue.increment(-150)
        }).then(() => {
            userProfile.zafyreCoins = (userProfile.zafyreCoins || 0) - 150;
            showToast('✅ +10 mensagens adicionadas! (150 ZafyreCoins debitados)', 'success');
            dailyMessageCounts[currentChatPartner.uid] = Math.max(0, (dailyMessageCounts[currentChatPartner.uid] || 0) - 10);
            saveDailyLimits();
            updateProfileUI();
            document.querySelector('.modal').remove();
        }).catch(error => {
            console.error('Erro ao debitar ZafyreCoins para mensagens:', error);
            showToast('❌ Erro ao processar compra de mensagens', 'error');
        });
    } else {
        showToast('❌ ZafyreCoins insuficientes. Compre mais na ZafyreShop!', 'error');
        showInsufficientCoinsModal('mensagens');
    }
}

function watchAdsForMessages() {
    showToast('📺 Função de anúncios para mensagens será implementada em breve!', 'info');
    document.querySelector('.modal').remove();
}

function showMediaUnlockModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Fotos e Áudios Bloqueados</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <p>Você precisa trocar pelo menos <strong>${MINIMUM_MESSAGES_FOR_MEDIA} mensagens</strong> antes de poder enviar fotos e áudios.</p>
                <p>Continue conversando para desbloquear esta funcionalidade!</p>
                <div style="margin: 20px 0;">
                    <button onclick="this.closest('.modal').remove();"
                            style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-comment"></i> Continuar Conversando
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function previewPpvContent(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('ppv-image-preview');
    const videoPreview = document.getElementById('ppv-video-preview');

    if(!preview || !videoPreview) return;

    preview.classList.add('hidden');
    preview.src = '';
    videoPreview.classList.add('hidden');
    videoPreview.src = '';

    if (file) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            videoPreview.src = URL.createObjectURL(file);
            videoPreview.classList.remove('hidden');
            videoPreview.load();
        } else {
            showToast('❌ Formato de arquivo PPV não suportado! Apenas imagens e vídeos.', 'error');
        }
    }
}

async function uploadPpvContent() {
    const file = document.getElementById('ppv-upload-file').files[0];
    const title = document.getElementById('ppv-title').value.trim();
    const priceInput = document.getElementById('ppv-price');
    const price = parseFloat(priceInput.value);

    if (!file) {
        showToast('❌ Selecione um arquivo para upload!', 'error');
        return;
    }

    if (!title) {
        showToast('❌ Digite um título para o conteúdo!', 'error');
        return;
    }

    if (isNaN(price) || price < 1.99) {
        showToast('❌ Digite um preço válido (mínimo R$ 1,99)!', 'error');
        return;
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    const maxPpvFileSize = 50 * 1024 * 1024; // 50MB para PPV

    if (!allowedImageTypes.includes(file.type) && !allowedVideoTypes.includes(file.type)) {
        showToast('❌ Tipo de arquivo não suportado para PPV (apenas imagens e vídeos)!', 'error');
        return;
    }
    if (file.size > maxPpvFileSize) {
        showToast(`❌ Arquivo muito grande! Máximo ${maxPpvFileSize / (1024 * 1024)}MB para PPV.`, 'error');
        return;
    }

    try {
        showToast('📤 Fazendo upload do conteúdo PPV...', 'info');

        const mediaUrl = await uploadToCloudinary(file, 'ppv');

        const ppvData = {
            creatorId: currentUser.uid,
            title: title,
            mediaUrl: mediaUrl,
            mediaType: file.type.startsWith('image/') ? 'image' : 'video',
            price: price,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            purchases: 0,
            revenue: 0
        };

        await db.collection('ppvContent').add(ppvData);

        // Também criar um post no feed marcado como PPV
        const postData = {
            userId: currentUser.uid,
            content: `💎 Conteúdo Premium: ${title}`,
            imageUrl: mediaUrl,
            isPpv: true,
            ppvPrice: price,
            title: title,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: 0,
            comments: 0,
            shares: 0,
            authorName: userProfile?.username || 'Usuário',
            authorPicture: userProfile?.profilePictureUrl || userProfile?.profilePicture || '',
            isCreator: true
        };

        await db.collection('posts').add(postData);

        // Limpar campos após sucesso
        document.getElementById('ppv-upload-file').value = '';
        document.getElementById('ppv-title').value = '';
        if(priceInput) priceInput.value = '';

        const ppvImagePreview = document.getElementById('ppv-image-preview');
        const ppvVideoPreview = document.getElementById('ppv-video-preview');

        if(ppvImagePreview){
            ppvImagePreview.classList.add('hidden');
            ppvImagePreview.src = '';
        }
        if(ppvVideoPreview){
            ppvVideoPreview.classList.add('hidden');
            ppvVideoPreview.src = '';
        }

        showToast('✅ Conteúdo PPV publicado com sucesso!', 'success');
        
        // Atualizar contador de posts se necessário
        if (userProfile) {
            userProfile.posts = (userProfile.posts || 0) + 1;
            await db.collection('users').doc(currentUser.uid).update({
                posts: firebase.firestore.FieldValue.increment(1)
            });
            updateProfileUI();
        }
        
        // Recarregar feed para mostrar novo conteúdo
        setTimeout(() => {
            loadFeed();
        }, 1000);

    } catch (error) {
        console.error('Erro ao fazer upload PPV:', error);
        showToast('❌ Erro ao publicar conteúdo PPV.', 'error');
    }
}

// --- Funções da ZafyreShop (ZafyreCoins e Premium) ---

function updateCoinPackages() {
    const coinPackages = document.getElementById('coin-packages');
    if (!coinPackages) return;

    coinPackages.innerHTML = `
        <div class="package-card" onclick="purchaseCoins(100, 4.99)">
            <div class="package-title">100 ZafyreCoins</div>
            <div class="package-price">R$ 4,99</div>
            <div class="package-features">Valor básico</div>
        </div>
        <div class="package-card" onclick="purchaseCoins(250, 9.99)">
            <div class="package-title">250 ZafyreCoins</div>
            <div class="package-price">R$ 9,99</div>
            <div class="package-features">Mais popular</div>
        </div>
        <div class="package-card" onclick="purchaseCoins(600, 19.99)">
            <div class="package-title">600 ZafyreCoins</div>
            <div class="package-price">R$ 19,99</div>
            <div class="package-features">Melhor valor</div>
        </div>
        <div class="package-card" onclick="purchaseCoins(1500, 39.99)">
            <div class="package-title">1.500 ZafyreCoins</div>
            <div class="package-price">R$ 39,99</div>
            <div class="package-features">Super oferta</div>
        </div>
        <div class="package-card" onclick="purchaseCoins(3500, 79.99)">
            <div class="package-title">3.500 ZafyreCoins</div>
            <div class="package-price">R$ 79,99</div>
            <div class="package-features">Máximo valor</div>
        </div>
    `;

    const premiumPackages = document.getElementById('premium-packages');
    if (!premiumPackages) return;

    premiumPackages.innerHTML = `
        <div class="package-card premium-card" onclick="purchasePremium('monthly', 19.99)">
            <div class="package-title">Premium Mensal</div>
            <div class="package-price">R$ 19,99</div>
            <div class="package-features">
                <ul>
                    <li><i class="fas fa-check"></i> Swipes ilimitados</li>
                    <li><i class="fas fa-check"></i> Chat ilimitado</li>
                    <li><i class="fas fa-check"></i> Sem anúncios</li>
                </ul>
            </div>
        </div>
        <div class="package-card premium-card" onclick="purchasePremium('quarterly', 49.99)">
            <div class="package-title">Premium Trimestral</div>
            <div class="package-price">R$ 49,99 <span class="old-price">R$ 59,97</span></div>
            <div class="package-features">
                <ul>
                    <li><i class="fas fa-check"></i> Todas as vantagens mensais</li>
                    <li><i class="fas fa-check"></i> Economize 16%</li>
                </ul>
            </div>
        </div>
        <div class="package-card premium-card" onclick="purchasePremium('semiannual', 89.99)">
            <div class="package-title">Premium Semestral</div>
            <div class="package-price">R$ 89,99 <span class="old-price">R$ 119,94</span></div>
            <div class="package-features">
                <ul>
                    <li><i class="fas fa-check"></i> Todas as vantagens trimestrais</li>
                    <li><i class="fas fa-check"></i> Economize 25%</li>
                </ul>
            </div>
        </div>
        <div class="package-card premium-card" onclick="purchasePremium('annual', 149.99)">
            <div class="package-title">Premium Anual</div>
            <div class="package-price">R$ 149,99 <span class="old-price">R$ 239,88</span></div>
            <div class="package-features">
                <ul>
                    <li><i class="fas fa-check"></i> Todas as vantagens semestrais</li>
                    <li><i class="fas fa-check"></i> Economize 37%</li>
                </ul>
            </div>
        </div>
    `;
}

async function purchaseCoins(amount, price) {
    showToast('💳 Integração com Mercado Pago será implementada em breve!', 'info');

    if (confirm(`Confirma a compra de ${amount} ZafyreCoins por R$ ${price.toFixed(2)}? (Simulação)`)) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                zafyreCoins: firebase.firestore.FieldValue.increment(amount)
            });

            userProfile.zafyreCoins = (userProfile.zafyreCoins || 0) + amount;
            updateProfileUI();

            showToast(`✅ ${amount} ZafyreCoins adicionados à sua conta!`, 'success');
        } catch (error) {
            console.error('Erro ao processar compra de coins:', error);
            showToast('❌ Erro ao processar compra', 'error');
        }
    }
}

async function purchasePremium(period, price) {
    showToast('💎 Integração com Mercado Pago será implementada em breve!', 'info');

    if (confirm(`Confirma a assinatura Premium ${period} por R$ ${price.toFixed(2)}? (Simulação)`)) {
        try {
            let expiryDate = new Date();
            if (period === 'monthly') expiryDate.setMonth(expiryDate.getMonth() + 1);
            else if (period === 'quarterly') expiryDate.setMonth(expiryDate.getMonth() + 3);
            else if (period === 'semiannual') expiryDate.setMonth(expiryDate.getMonth() + 6);
            else if (period === 'annual') expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            const premiumData = {
                isPremium: true,
                premiumType: period,
                premiumExpires: firebase.firestore.Timestamp.fromDate(expiryDate)
            };

            await db.collection('users').doc(currentUser.uid).update(premiumData);

            Object.assign(userProfile, premiumData);
            updateProfileUI();

            showToast(`✅ Premium ${period} ativado com sucesso!`, 'success');
        } catch (error) {
            console.error('Erro ao ativar Premium:', error);
            showToast('❌ Erro ao ativar Premium', 'error');
        }
    }
}

// --- Funções de Modal de Saldo Insuficiente ---
function showInsufficientCoinsModal(action) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">ZafyreCoins Insuficientes</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <p>Você não tem ZafyreCoins suficientes para esta ${action}.</p>
                <p>Saldo atual: <strong>${userProfile.zafyreCoins || 0} ZafyreCoins</strong></p>
                <div style="margin: 20px 0;">
                    <button onclick="showSection('zafyre-shop-section'); this.closest('.modal').remove();"
                            style="background: var(--primary-color); color: var(--secondary-color); border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                        <i class="fas fa-shopping-cart"></i> Comprar ZafyreCoins
                    </button>
                </div>
                <p style="color: var(--accent-color); font-size: 0.9em;">
                    Ou assine o Premium para ${action === 'mensagem' ? 'chat ilimitado' : 'uso ilimitado'}!
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// --- Função para Solicitar Saque (apenas feminino criador) ---
function requestPayout() {
    if (!userProfile || userProfile.gender !== 'Feminino') {
        showToast('Apenas criadoras femininas podem solicitar saque.', 'error');
        return;
    }

    const balance = userProfile.zafyreCoins || 0;
    const conversionRate = 0.05; // 1 ZafyreCoin = R$ 0.05
    const realValue = balance * conversionRate;

    const MIN_PAYOUT = 50;
    const MAX_DAILY_PAYOUT = 500;

    if (realValue < MIN_PAYOUT) {
        showToast(`❌ Saldo mínimo para saque: R$ ${MIN_PAYOUT.toFixed(2)} (equivalente a ${Math.ceil(MIN_PAYOUT / conversionRate)} ZafyreCoins)`, 'error');
        return;
    }

    if (realValue > MAX_DAILY_PAYOUT) {
        showToast(`❌ Valor máximo para saque diário: R$ ${MAX_DAILY_PAYOUT.toFixed(2)}`, 'error');
        return;
    }

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado

    if (hour < 11 || hour >= 18) {
        showToast('❌ Saques permitidos apenas das 11h às 18h (Horário de Brasília).', 'error');
        return;
    }

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        showToast('❌ Saques permitidos apenas em dias úteis (Segunda a Sexta).', 'error');
        return;
    }

    if (confirm(`Confirma a solicitação de saque de R$ ${realValue.toFixed(2)}? Seus ${balance} ZafyreCoins serão zerados.`)) {
        try {
            db.collection('payoutRequests').add({
                userId: currentUser.uid,
                username: userProfile.username,
                email: currentUser.email,
                zafyreCoins: balance,
                payoutAmountReal: realValue,
                status: 'pending',
                requestDate: firebase.firestore.FieldValue.serverTimestamp(),
            }).then(async () => {
                await db.collection('users').doc(currentUser.uid).update({
                    zafyreCoins: 0
                });
                userProfile.zafyreCoins = 0;
                updateProfileUI();

                showToast(`💰 Solicitação de saque de R$ ${realValue.toFixed(2)} enviada! Será processada em até 2 dias úteis via Mercado Pago.`, 'success');
            }).catch(error => {
                console.error('Erro ao registrar solicitação de saque:', error);
                showToast('❌ Erro ao solicitar saque. Tente novamente.', 'error');
            });
        } catch (error) {
            console.error('Erro geral na função de saque:', error);
            showToast('❌ Ocorreu um erro inesperado ao solicitar saque.', 'error');
        }
    }
}

// --- Inicialização da Aplicação ---
document.addEventListener('DOMContentLoaded', () => {
    // A inicialização do Firebase e atribuição de 'auth' e 'db' já está no topo do script.

    loadDailyLimits();
    updateCoinPackages();
    showSection('auth-section'); // Inicia na tela de autenticação
});

// Funções globais para serem acessíveis do HTML
window.togglePostOptions = function(postId) {
    const dropdown = document.getElementById(`post-options-${postId}`);
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }

    document.querySelectorAll('.options-dropdown-content').forEach(otherDropdown => {
        if (otherDropdown.id !== `post-options-${postId}`) {
            otherDropdown.classList.add('hidden');
        }
    });
};

document.addEventListener('click', (event) => {
    document.querySelectorAll('.options-dropdown-content').forEach(dropdown => {
        if (!dropdown.previousElementSibling || !dropdown.previousElementSibling.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });
});

window.editPost = async function(postId, currentContent, currentImageUrl) {
    // Verificar se o usuário tem permissão para editar este post
    try {
        const postDoc = await db.collection('posts').doc(postId).get();
        if (!postDoc.exists) {
            showToast('❌ Post não encontrado!', 'error');
            return;
        }
        
        const postData = postDoc.data();
        if (!currentUser || postData.userId !== currentUser.uid) {
            showToast('❌ Você não tem permissão para editar este post!', 'error');
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar permissões do post:', error);
        showToast('❌ Erro ao verificar permissões', 'error');
        return;
    }

    const decodedContent = decodeURIComponent(currentContent);
    const decodedImageUrl = decodeURIComponent(currentImageUrl);

    const newContent = prompt('Editar conteúdo do post:', decodedContent);
    if (newContent === null) return;

    const newImageFile = document.createElement('input');
    newImageFile.type = 'file';
    newImageFile.accept = 'image/*';

    const uploadImage = confirm('Deseja alterar a imagem do post?');
    let imageUrlToUpdate = decodedImageUrl;

    if (uploadImage) {
        newImageFile.click();
        newImageFile.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    showToast('📤 Fazendo upload da nova imagem...', 'info');
                    imageUrlToUpdate = await uploadToCloudinary(file, 'posts');
                    showToast('✅ Nova imagem carregada!', 'success');
                } catch (error) {
                    console.error('Erro ao fazer upload da nova imagem:', error);
                    showToast('❌ Erro ao carregar nova imagem. Mantendo a anterior.', 'error');
                    imageUrlToUpdate = decodedImageUrl;
                }
            } else {
                imageUrlToUpdate = '';
            }

            try {
                await db.collection('posts').doc(postId).update({
                    content: newContent,
                    imageUrl: imageUrlToUpdate,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('✅ Post atualizado com sucesso!', 'success');
                loadFeed();
            } catch (error) {
                console.error('Erro ao atualizar post:', error);
                showToast('❌ Erro ao atualizar post. Tente novamente.', 'error');
            }
        };
    } else {
        try {
            await db.collection('posts').doc(postId).update({
                content: newContent,
                imageUrl: decodedImageUrl,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('✅ Post atualizado com sucesso!', 'success');
            loadFeed();
        } catch (error) {
            console.error('Erro ao atualizar post:', error);
            showToast('❌ Erro ao atualizar post. Tente novamente.', 'error');
        }
    }
};

window.deletePost = async function(postId) {
    // Verificar se o usuário tem permissão para excluir este post
    try {
        const postDoc = await db.collection('posts').doc(postId).get();
        if (!postDoc.exists) {
            showToast('❌ Post não encontrado!', 'error');
            return;
        }
        
        const postData = postDoc.data();
        if (!currentUser || postData.userId !== currentUser.uid) {
            showToast('❌ Você não tem permissão para excluir este post!', 'error');
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar permissões do post:', error);
        showToast('❌ Erro ao verificar permissões', 'error');
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este post?')) return;

    try {
        await db.collection('posts').doc(postId).delete();

        if (userProfile) {
            await db.collection('users').doc(currentUser.uid).update({
                posts: firebase.firestore.FieldValue.increment(-1)
            });
            userProfile.posts = Math.max(0, (userProfile.posts || 0) - 1);
            updateProfileUI();
        }

        showToast('🗑️ Post excluído com sucesso!', 'success');
        loadFeed();
    } catch (error) {
        console.error('Erro ao excluir post:', error);
        showToast('❌ Erro ao excluir post. Tente novamente.', 'error');
    }
};

window.toggleLikePost = async function(postId) {
    if (!currentUser) {
        showToast('Você precisa estar logado para curtir posts!', 'error');
        return;
    }

    const postRef = db.collection('posts').doc(postId);
    const userRef = db.collection('users').doc(currentUser.uid);

    try {
        const postDoc = await postRef.get();
        const userDoc = await userRef.get();

        if (!postDoc.exists || !userDoc.exists) return;

        const postData = postDoc.data();
        const userData = userDoc.data();

        let likedPosts = userData.likedPosts || [];
        const likesElement = document.getElementById(`likes-${postId}`);
        const heartIcon = likesElement.previousElementSibling;

        if (likedPosts.includes(postId)) {
            likedPosts = likedPosts.filter(id => id !== postId);
            await postRef.update({
                likes: firebase.firestore.FieldValue.increment(-1)
            });
            heartIcon.classList.remove('liked');
            likesElement.textContent = (postData.likes || 0) - 1;
            showToast('💔 Post descurtido.', 'info');
        } else {
            likedPosts.push(postId);
            await postRef.update({
                likes: firebase.firestore.FieldValue.increment(1)
            });
            heartIcon.classList.add('liked');
            likesElement.textContent = (postData.likes || 0) + 1;
            showToast('❤️ Post curtido!', 'success');
        }

        await userRef.update({ likedPosts: likedPosts });
        userProfile.likedPosts = likedPosts;
    } catch (error) {
        console.error('Erro ao curtir/descurtir post:', error);
        showToast('❌ Erro ao curtir/descurtir post.', 'error');
    }
};

window.showComments = function(postId) {
    showToast('💬 Sistema de comentários será implementado em breve!', 'info');
};

window.sharePost = function(postId) {
    showToast('🔗 Função de compartilhamento será implementada em breve!', 'info');
};

window.toggleFollow = async function(userId) {
    if (!currentUser) {
        showToast('Você precisa estar logado para seguir/deixar de seguir!', 'error');
        return;
    }

    try {
        const followQuery = db.collection('follows')
            .where('followerId', '==', currentUser.uid)
            .where('followingId', '==', userId);

        const snapshotPromise = followQuery.get();
        snapshotPromise.then(snapshot => {

            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    doc.ref.delete();
                });
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.increment(-1)
                });
                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.increment(-1)
                });
                followingList = followingList.filter(id => id !== userId);
                showToast('❌ Deixou de seguir usuário', 'info');
            } else {
                db.collection('follows').add({
                    followerId: currentUser.uid,
                    followingId: userId,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                db.collection('users').doc(currentUser.uid).update({
                    following: firebase.firestore.FieldValue.increment(1)
                });
                db.collection('users').doc(userId).update({
                    followers: firebase.firestore.FieldValue.increment(1)
                });
                followingList.push(userId);
                showToast('✅ Agora você está seguindo este usuário!', 'success');
            }

            // Atualizar o botão de seguir na UI do feed (se visível)
            // Isso pode ser feito encontrando o elemento e atualizando a classe/texto
            // Uma abordagem mais robusta seria recarregar o feed para garantir consistência
            loadFeed();
        });

    } catch (error) {
        console.error('Erro ao seguir/deixar de seguir:', error);
        showToast('❌ Erro ao processar solicitação', 'error');
    }
};

window.openUserProfile = async function(userId) {
    if (!userId || userId === currentUser.uid) {
        showSection('profile-section');
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            showToast('❌ Perfil não encontrado!', 'error');
            return;
        }

        const userData = userDoc.data();
        showUserProfileModal(userId, userData);
    } catch (error) {
        console.error('Erro ao carregar perfil do usuário:', error);
        showToast('❌ Erro ao carregar perfil', 'error');
    }
};

function showUserProfileModal(userId, userData) {
    const isFollowing = checkIfFollowing(userId);
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title">Perfil de ${userData.username}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="text-align: center; padding: 20px;">
                <div class="profile-avatar-container" style="margin-bottom: 20px;">
                    <img src="${userData.profilePictureUrl || userData.profilePicture || 'https://via.placeholder.com/120'}" 
                         alt="${userData.username}" 
                         style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary-color);">
                    ${userData.isCreator ? '<div style="position: absolute; bottom: 5px; right: 5px; background: var(--creator-color); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white;"><i class="fas fa-crown"></i></div>' : ''}
                </div>
                
                <h3 style="color: var(--primary-color); margin-bottom: 10px;">
                    ${userData.username}
                    ${userData.isCreator ? '<i class="fas fa-crown" style="color: var(--creator-color); margin-left: 5px;"></i>' : ''}
                </h3>
                
                <p style="color: var(--secondary-text-color); margin-bottom: 20px;">${userData.bio || 'Sem biografia'}</p>
                
                <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px;">
                    <div style="text-align: center;">
                        <div style="font-size: 1.4em; font-weight: 600; color: var(--primary-color);">${userData.age || '?'}</div>
                        <div style="font-size: 0.8em; color: var(--secondary-text-color);">Anos</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.4em; font-weight: 600; color: var(--primary-color);">${userData.followers || 0}</div>
                        <div style="font-size: 0.8em; color: var(--secondary-text-color);">Seguidores</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.4em; font-weight: 600; color: var(--primary-color);">${userData.posts || 0}</div>
                        <div style="font-size: 0.8em; color: var(--secondary-text-color);">Posts</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button onclick="toggleFollow('${userId}'); this.closest('.modal').remove();" 
                            style="background: ${isFollowing ? 'var(--border-color)' : 'var(--primary-color)'}; color: ${isFollowing ? 'var(--text-color)' : 'var(--secondary-color)'}; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600;">
                        ${isFollowing ? '<i class="fas fa-user-minus"></i> Deixar de Seguir' : '<i class="fas fa-user-plus"></i> Seguir'}
                    </button>
                    <button onclick="startChatWithUser('${userId}'); this.closest('.modal').remove();" 
                            style="background: var(--accent-color); color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-comment"></i> Conversar
                    </button>
                </div>
                
                <div style="margin-top: 25px;">
                    <button onclick="loadUserPosts('${userId}'); this.closest('.modal').remove();" 
                            style="background: var(--card-background); color: var(--text-color); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 15px; cursor: pointer;">
                        <i class="fas fa-images"></i> Ver Posts (${userData.posts || 0})
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function startChatWithUser(userId) {
    try {
        let chatId = null;
        const existingChats = await db.collection('chats')
            .where('participants', 'array-contains', currentUser.uid)
            .get();

        existingChats.forEach(doc => {
            const participants = doc.data().participants;
            if (participants.includes(userId)) {
                chatId = doc.id;
            }
        });

        if (!chatId) {
            chatId = await createChat(userId);
        }

        if (chatId) {
            const partnerDoc = await db.collection('users').doc(userId).get();
            if (partnerDoc.exists) {
                openChat(chatId, partnerDoc.data());
                showSection('chat-section');
                document.getElementById('chat-conversation-modal').classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Erro ao iniciar chat:', error);
        showToast('❌ Erro ao iniciar conversa', 'error');
    }
}

async function loadUserPosts(userId) {
    showToast('📄 Carregando posts do usuário...', 'info');
    // Esta função pode ser expandida para mostrar uma modal com os posts do usuário
    // Por agora, apenas mostra uma mensagem
    showToast('🔍 Visualização de posts por usuário será implementada na próxima versão!', 'info');
}

console.log('Script carregado completamente');
