import React, { useState } from 'react';
import { X } from 'lucide-react';

const BookingModal = ({ service, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate network delay for realistic feel
    setTimeout(() => {
      const dummyTicketId = 'tk_' + Math.random().toString(36).substring(2, 9);
      
      // Save ticket id to local storage for live tracking capability
      localStorage.setItem('ticket_id', dummyTicketId);
      
      // Save mocked ticket data to storage so the Tracker can read it
      localStorage.setItem('mock_ticket_' + dummyTicketId, JSON.stringify({
        id: dummyTicketId,
        student_name: name,
        service_id: service.id,
        service_name: service.service_name,
        status: 'waiting',
        estWaitTime: 20
      }));

      onSuccess(dummyTicketId);
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-1">إصدار تذكرة مراجعة</h2>
          <p className="text-gray-600 mb-6">الخدمة: <span className="font-semibold text-indigo-600">{service.service_name}</span></p>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">اسم المراجع</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="مثال: أحمد محمد"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">البريد الجامعي</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="student@university.edu"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-all ${
                isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md'
              }`}
            >
              {isSubmitting ? 'جاري إصدار التذكرة...' : 'تأكيد إصدار التذكرة'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
