import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Sparkles } from 'lucide-react';
import { getPolicies } from '../services/storage';
import { chatWithContext } from '../services/claude';
import { getChatHistory, saveChatHistory, clearChatHistory } from '../services/storage';

function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [policies, setPolicies] = useState([]);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        setPolicies(getPolicies());
        setMessages(getChatHistory());
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            const response = await chatWithContext(input, policies);
            const assistantMessage = { role: 'assistant', content: response };
            const updatedMessages = [...newMessages, assistantMessage];
            setMessages(updatedMessages);
            saveChatHistory(updatedMessages);
        } catch (error) {
            console.error('Erreur chat:', error);
            const errorMessage = {
                role: 'assistant',
                content: `Désolé, une erreur s'est produite: ${error.message}`
            };
            setMessages([...newMessages, errorMessage]);
        }

        setLoading(false);
    };

    const handleClear = () => {
        if (confirm('Effacer l\'historique de conversation ?')) {
            clearChatHistory();
            setMessages([]);
        }
    };

    const suggestedQuestions = [
        "Est-ce que je suis bien couvert si je me fais voler mon vélo ?",
        "Ma RC ménage est-elle trop chère ?",
        "Quand dois-je résilier pour changer de caisse maladie ?",
        "Ai-je des doublons dans mes assurances ?",
        "Comment réduire mes primes d'assurance ?"
    ];

    return (
        <div className="chat-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h1 className="page-title" style={{ marginBottom: 0 }}>💬 Assistant</h1>
                {messages.length > 0 && (
                    <button onClick={handleClear} className="btn btn-secondary" style={{ padding: '8px' }}>
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            <div className="chat-messages">
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <Sparkles size={48} color="var(--sage-green)" style={{ marginBottom: '16px' }} />
                        <h3>Comment puis-je t'aider ?</h3>
                        <p style={{ color: 'var(--charcoal-light)', marginTop: '8px', marginBottom: '24px' }}>
                            Je connais toutes tes polices ({policies.length} enregistrée{policies.length > 1 ? 's' : ''}) et peux répondre à tes questions.
                        </p>

                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>Essaie par exemple :</p>
                            {suggestedQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(q)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '12px 16px',
                                        marginBottom: '8px',
                                        background: 'var(--beige)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: 'var(--charcoal)'
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`message message-${msg.role}`}
                        >
                            {msg.content}
                        </div>
                    ))
                )}

                {loading && (
                    <div className="message message-assistant">
                        <div className="loading" style={{ padding: '0' }}>
                            <div className="spinner"></div>
                            <span>Réflexion en cours...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <input
                    type="text"
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Pose ta question..."
                    disabled={loading}
                />
                <button
                    className="chat-send-btn"
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                >
                    <Send size={20} />
                </button>
            </div>
        </div>
    );
}

export default Chat;
