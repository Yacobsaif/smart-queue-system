import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, Clock } from 'lucide-react';

const Track = () => {
  const { ticketId: paramTicketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  
  useEffect(() => {
    const id = paramTicketId || localStorage.getItem('ticket_id');
    if (!id) {
      navigate('/');
      return;
    }

    // Load mock ticket from localStorage
    const savedMock = localStorage.getItem('mock_ticket_' + id);
    if (savedMock) {
      setTicket(JSON.parse(savedMock));
    } else {
      // Fallback
      setTicket({
        id,
        student_name: 'Guest User',
        service_name: 'General Assistance',
        status: 'waiting',
        estWaitTime: 5
      });
    }

  }, [paramTicketId, navigate]);

  if (!ticket) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className={`min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-500 bg-gray-50`}>
      
      <div className={`max-w-md w-full rounded-2xl shadow-xl overflow-hidden transition-all duration-300 bg-white`}>
        <div className="p-6 text-center border-b border-gray-100">
          <h2 className="text-sm font-semibold tracking-widest text-gray-400 uppercase mb-1">تذكرة المراجعة الإلكترونية</h2>
          <h1 className="text-2xl font-bold text-gray-900">{ticket.student_name}</h1>
          <p className="text-indigo-600 font-medium">{ticket.service_name}</p>
        </div>

        <div className="p-8 pb-10">
          <div className="text-center space-y-8">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">الحالة</p>
              <div className="text-4xl font-black text-gray-900 tracking-tighter">
                في قائمة الانتظار...
              </div>
            </div>
            
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex items-center justify-center gap-3">
              <Clock className="w-6 h-6 text-indigo-500" />
              <div className="text-start">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">وقت الانتظار التقريبي</p>
                <p className="text-xl font-bold text-indigo-900">{ticket.estWaitTime} دقيقة</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <button 
        onClick={() => {
          localStorage.removeItem('ticket_id');
          navigate('/');
        }} 
        className="mt-8 font-medium text-gray-500 hover:text-gray-900"
      >
        إلغاء التذكرة والعودة
      </button>
    </div>
  );
};

export default Track;
