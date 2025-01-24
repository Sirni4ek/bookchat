// BookChat JavaScript (2025-01-08T12:20:30-05:00)

let currentUsername = 'anonymous';
let messageVerificationEnabled = false;

// Initialize everything
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing...');
    await verifyUsername();
    setupMessageInput();
    setupUsernameUI();
    
    // Load messages and ensure scroll
    await loadMessages();
    
    // Add scroll to bottom when window is resized
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => scrollToBottom(), 100);
    });
});

async function verifyUsername() {
    try {
        // TODO: Add timeout to fetch request to prevent hanging
        // TODO: Add retry logic for failed requests
        const response = await fetch('/verify_username');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentUsername = data.username;
        
        localStorage.setItem('username', currentUsername);
        
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) {
            usernameDisplay.textContent = currentUsername;
        }
        
        return data.status === 'verified';
    } catch (error) {
        console.error('Error verifying username:', error);
        currentUsername = localStorage.getItem('username') || 'anonymous';
        return false;
    }
}

async function loadMessages() {
    try {
        const response = await fetch('/messages');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data.success) {
            console.error('Error loading messages:', data.error);
            return;
        }
        
        // Get messages
        let messages = data.messages || [];
        
        // Clear existing messages
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        // Add messages
        messages.forEach(message => {
            const messageElement = createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom after a delay to ensure rendering
        setTimeout(() => {
            scrollToBottom(true); // Use immediate scroll for initial load
            // Double-check scroll position after images/content loads
            window.requestAnimationFrame(() => {
                scrollToBottom(true);
            });
        }, 100);
        
    } catch (error) {
        console.error('Error:', error);
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '<p class="error">Error loading messages. Please try again later.</p>';
    }
}

async function sendMessage(content, type = 'message') {
    let tempMessage;
    try {
        const timestamp = new Date().toISOString();
        tempMessage = {
            id: `temp-${Date.now()}`,
            content: content,
            author: currentUsername,
            timestamp: timestamp
        };
        
        // Create message element
        const messagesContainer = document.getElementById('messages-container');
        const messageElement = createMessageElement(tempMessage);
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        scrollToBottom();
        
        // Send message to server
        const response = await fetch('/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                type: type
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to send message');
        }

        return result;
    } catch (error) {
        console.error('Error:', error);
        if (tempMessage) {
            const element = document.getElementById(`message-${tempMessage.id}`);
            if (element) {
                element.classList.add('error');
            }
        }
        throw error;
    }
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = message.id || '';

    // Create message header
    const header = document.createElement('div');
    header.className = 'message-header';
    
    const headerLeft = document.createElement('div');
    headerLeft.className = 'header-left';

    // Add author
    const author = document.createElement('span');
    author.className = 'author';
    author.textContent = message.author || 'anonymous';
    headerLeft.appendChild(author);

    // Add timestamp
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    if (message.pending) {
        timestamp.textContent = 'Sending...';
        timestamp.className += ' pending';
    } else {
        try {
            // Use either timestamp or createdAt field
            const messageDate = new Date(message.timestamp || message.createdAt);
            const options = { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            };
            timestamp.textContent = formatTimestamp(message.timestamp || message.createdAt);
            timestamp.title = messageDate.toLocaleString();
        } catch (error) {
            console.error('Error formatting date:', error);
            timestamp.textContent = 'Unknown time';
        }
    }
    headerLeft.appendChild(timestamp);
    header.appendChild(headerLeft);
    messageDiv.appendChild(header);

    // Create message content
    const content = document.createElement('div');
    content.className = 'content';
    
    // Strip signature block from content
    let messageContent = message.content;
    const signatureIndex = messageContent.indexOf('\n-- \n');
    if (signatureIndex !== -1) {
        messageContent = messageContent.substring(0, signatureIndex);
    }
    
    content.textContent = messageContent;
    messageDiv.appendChild(content);

    return messageDiv;
}

async function changeUsername(newUsername) {
    try {
        // Validate username format
        if (!USERNAME_REGEX.test(newUsername)) {
            alert('Username must be 3-20 characters long and contain only letters, numbers, and underscores.');
            return false;
        }

        // Call the username change endpoint
        const response = await fetch('/change_username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                old_username: currentUsername,
                new_username: newUsername
            })
        });

        if (!response.ok) {
            const error = await response.text();
            alert(error);
            return false;
        }

        // Update local state
        currentUsername = newUsername;
        localStorage.setItem('username', newUsername);
        
        // Update display
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) {
            usernameDisplay.textContent = currentUsername;
        }
        
        return true;
    } catch (error) {
        console.error('Error changing username:', error);
        alert('Failed to change username. Please try again.');
        return false;
    }
}

// Add username change UI
function setupUsernameUI() {
    // Update username display
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay) {
        usernameDisplay.textContent = currentUsername;
    }

    // Set up change username button click handler
    const changeButton = document.getElementById('change-username-btn');
    if (changeButton) {
        changeButton.onclick = async () => {
            const newUsername = prompt('Enter new username:');
            if (newUsername) {
                const success = await changeUsername(newUsername);
                if (!success) {
                    alert('Failed to change username. Please try a different username.');
                }
            }
        };
    }
}

function setupMessageInput() {
    // Hide no-JS form and show JS form
    const noJsForm = document.getElementById('message-form');
    const jsForm = document.getElementById('js-message-form');
    if (noJsForm && jsForm) {
        noJsForm.style.display = 'none';
        jsForm.style.display = 'flex';
    }
    
    const messageForm = document.getElementById('js-message-form');
    const messageInput = document.getElementById('message-input');
    
    if (messageForm && messageInput) {
        // Add character counter functionality
        const charCounter = document.getElementById('js-char-counter');
        if (charCounter) {
            messageInput.addEventListener('input', () => {
                const count = messageInput.value.length;
                charCounter.textContent = count;
            });
        }

        // Function to validate and send message
        const validateAndSendMessage = async (content) => {
            // Ensure content is a string and properly trimmed
            content = String(content || '').trim();
            
            if (!content) {
                console.log('Empty content detected, preventing submission');
                messageInput.classList.add('error');
                setTimeout(() => messageInput.classList.remove('error'), 2000);
                return false;
            }

            // Clear input immediately
            const originalContent = content;
            messageInput.value = '';
            // Reset character counter
            if (charCounter) {
                charCounter.textContent = '0';
            }
            
            const result = await sendMessage(originalContent);
            console.log('Send message result:', result);
            if (result.success) {
                console.log('Message sent successfully');
                return true;
            } else {
                console.error('Failed to send message:', result.error);
                messageInput.value = originalContent;
                // Update character counter to reflect restored content
                if (charCounter) {
                    charCounter.textContent = originalContent.length;
                }
                messageInput.classList.add('error');
                setTimeout(() => messageInput.classList.remove('error'), 2000);
                
                // Show error message to user
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = 'Failed to send message. Please try again.';
                messageForm.appendChild(errorDiv);
                setTimeout(() => errorDiv.remove(), 3000);
                return false;
            }
        };

        // Handle form submit (for button click)
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await validateAndSendMessage(messageInput.value);
        });
        
        // Handle Enter key press (Shift+Enter for new line)
        messageInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await validateAndSendMessage(messageInput.value);
            }
        });
    }
}

// Format timestamp into a human-readable format
function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return timestamp; // Return original string if invalid date
        }
        
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) {
            return 'Just now';
        } else if (minutes < 60) {
            return `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        } else if (days < 7) {
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    } catch (e) {
        return timestamp; // Return original string if any error occurs
    }
}

// Helper function to scroll messages to bottom
function scrollToBottom(immediate = false) {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        // Force a reflow to ensure accurate scrollHeight
        void messagesDiv.offsetHeight;
        
        const scrollHeight = messagesDiv.scrollHeight;
        const maxScroll = scrollHeight - messagesDiv.clientHeight;
        
        messagesDiv.scrollTo({
            top: maxScroll,
            behavior: immediate ? 'auto' : 'smooth'
        });
    }
}

// Update global verification status based on all messages
function updateGlobalVerificationStatus() {
    // Only update if verification is enabled
    if (!messageVerificationEnabled) {
        const globalStatus = document.getElementById('global-verification-status');
        if (globalStatus) {
            globalStatus.style.display = 'none';
        }
        return;
    }
    
    const messages = document.querySelectorAll('.message');
    const globalStatus = document.getElementById('global-verification-status');
    
    if (!messages.length || !globalStatus) return;
    
    let allVerified = true;
    let anyVerified = false;
    
    messages.forEach(message => {
        const status = message.querySelector('.verification-status');
        if (status && status.classList.contains('verified')) {
            anyVerified = true;
        } else {
            allVerified = false;
        }
    });
    
    globalStatus.className = 'global-verification-status';
    
    if (allVerified) {
        globalStatus.classList.add('verified');
        globalStatus.textContent = 'Chat Verification Status: All Messages Verified';
    } else if (anyVerified) {
        globalStatus.classList.add('partial');
        globalStatus.textContent = 'Chat Verification Status: Some Messages Verified';
    } else {
        globalStatus.classList.add('unverified');
        globalStatus.textContent = 'Chat Verification Status: No Messages Verified';
    }
}

// Username validation regex - only allow alphanumeric and underscore, 3-20 chars
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// Export functions for testing
module.exports = {
    formatTimestamp,
    sendMessage,
    setupMessageInput
};
