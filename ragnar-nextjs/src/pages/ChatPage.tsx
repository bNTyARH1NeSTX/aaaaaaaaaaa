import  useState  from 'react';

export default function ChatPage() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessages([...messages, message]);
    setMessage('');
  };

  return (
    <div>
      {/* Lista de mensajes */}
      {messages.map((msg, i) => (
        <div key={i}>
          {msg}
        </div>
      ))}

      {/* Entrada y botón de envío */}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe tu mensaje..."
      />
      <button onClick={handleSend}>
        Enviar
      </button>
    </div>
  );
}