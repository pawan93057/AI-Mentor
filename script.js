const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const loginOverlay = document.getElementById('login-overlay');
const imageModal = document.getElementById('image-modal');
const settingsModal = document.getElementById('settings-modal');
const apiKeyInput = document.getElementById('api-key-input');
const loginBtn = document.getElementById('login-btn');
const logoutBtnReal = document.getElementById('logout-btn-real');

const updateKeyInput = document.getElementById('update-api-key-input');
const updateKeyBtn = document.getElementById('update-key-btn');
const updateSuccessMsg = document.getElementById('update-success-msg');

const MODEL_NAME = "gemini-2.5-pro";

const SYSTEM_PROMPT = `You are a world-class AI Mentor. 
Your personality: 
1. Wise and knowledgeable like a senior scholar or doctor.
2. Compassionate and warm like a loving parent.
3. Accessible and relatable like a best friend.
4. Always polite, patient, and professional.

Your mission:
- When someone is in trouble, provide calm, logical, and practical solutions.
- Validate their feelings first, then offer guidance.
- Use helpful metaphors and encouraging language.
- If a medical or psychological question is asked, provide general wisdom but advise seeing a specialist if critical.
- Keep responses concise but impactful.`;

let savedApiKey = localStorage.getItem('mentor_api_key');

function checkAuth() {
    if (!savedApiKey) {
        loginOverlay.classList.remove('hidden');
    } else {
        loginOverlay.classList.add('hidden');
    }
}

function openImageModal() {
    imageModal.classList.remove('hidden');
    setTimeout(() => imageModal.classList.add('active'), 10);
}

function closeImageModal() {
    imageModal.classList.remove('active');
    setTimeout(() => imageModal.classList.add('hidden'), 300);
}

function toggleSettings() {
    if (settingsModal.classList.contains('hidden')) {
        settingsModal.classList.remove('hidden');
        setTimeout(() => settingsModal.classList.add('active'), 10);
    } else {
        settingsModal.classList.remove('active');
        setTimeout(() => {
            settingsModal.classList.add('hidden');
            updateSuccessMsg.classList.add('hidden'); 
            updateKeyInput.value = '';
        }, 300);
    }
}

function toggleAccordion(header) {
    const content = header.nextElementSibling;
    const allHeaders = document.querySelectorAll('.accordion-header');
    const allContents = document.querySelectorAll('.accordion-content');

    allHeaders.forEach(h => { if(h !== header) h.classList.remove('active') });
    allContents.forEach(c => { if(c !== content) c.classList.remove('active') });

    header.classList.toggle('active');
    content.classList.toggle('active');
}

loginBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('mentor_api_key', key);
        savedApiKey = key;
        checkAuth();
    }
});

updateKeyBtn.addEventListener('click', () => {
    const newKey = updateKeyInput.value.trim();
    if (newKey) {
        localStorage.setItem('mentor_api_key', newKey);
        savedApiKey = newKey;
        updateSuccessMsg.classList.remove('hidden');
        updateKeyInput.value = '';
        setTimeout(() => {
            updateSuccessMsg.classList.add('hidden');
        }, 3000);
    }
});

logoutBtnReal.addEventListener('click', () => {
    localStorage.removeItem('mentor_api_key');
    savedApiKey = null;
    location.reload();
});

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

function appendMessage(role, text, isError = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `flex w-full ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble p-3 text-sm ${role === 'user' ? 'user-bubble' : 'mentor-bubble'} ${isError ? 'border-2 border-red-200 bg-red-50' : ''}`;
    
    if (role === 'ai') {
        const header = isError ? '⚠️ SYSTEM ERROR' : 'AI Mentor';
        const headerColor = isError ? 'text-red-600' : 'text-emerald-700';
        bubble.innerHTML = `<p class="font-bold ${headerColor} text-[10px] mb-1 uppercase tracking-wider">${header}</p>${text.replace(/\n/g, '<br>')}`;
    } else {
        bubble.innerText = text;
    }

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
}

async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${savedApiKey}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
    };

    const maxRetries = 5;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorJson = await response.json().catch(() => ({}));
                const errorCode = response.status;
                const errorMessage = errorJson.error?.message || "Unknown API Error";

                if (errorCode === 401 || errorCode === 403) {
                    throw new Error(`[INVALID_KEY]: The API Key you provided is either incorrect, expired, or restricted. Please check your settings and try a different key.`);
                } else if (errorCode === 429) {
                    throw new Error(`[RATE_LIMIT]: You have reached the usage limit for this API Key. Please wait a minute or upgrade your plan in Google AI Studio.`);
                } else {
                    throw new Error(`[API_ERROR ${errorCode}]: ${errorMessage}`);
                }
            }

            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || "I'm reflecting on your words. Could you say that again?";

        } catch (error) {
            if (error.message.includes('INVALID_KEY') || error.message.includes('RATE_LIMIT')) {
                throw error;
            }
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

async function handleSend() {
    const text = userInput.value.trim();
    if (!text || !savedApiKey) return;

    userInput.value = '';
    userInput.style.height = 'auto';
    appendMessage('user', text);
    
    typingIndicator.classList.remove('hidden');
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });

    try {
        const response = await callGemini(text);
        typingIndicator.classList.add('hidden');
        appendMessage('ai', response);
    } catch (error) {
        typingIndicator.classList.add('hidden');
        const errorText = error.message.startsWith('[') 
            ? error.message.split(']:')[1].trim() 
            : error.message;
        
        appendMessage('ai', `Forgive me, but I've encountered a technical issue:\n\n<b>${errorText}</b>\n\nYou can update your API Key by clicking the ⚙️ Settings icon at the top right.`, true);
    }
}

sendBtn.addEventListener('click', handleSend);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

checkAuth();
