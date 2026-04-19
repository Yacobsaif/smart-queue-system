import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ServiceCard from '../components/ServiceCard';
import BookingModal from '../components/BookingModal';

const dummyServices = [
  { id: '1', service_name: 'شؤون الطلبة', estimated_duration_minutes: 10 },
  { id: '2', service_name: 'القسم المالي', estimated_duration_minutes: 15 },
  { id: '3', service_name: 'الدعم التقني', estimated_duration_minutes: 5 },
  { id: '4', service_name: 'خدمات المكتبة', estimated_duration_minutes: 8 }
];

const Home = () => {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);

  // Fake queue length for UI purposes
  const getDummyWaitingCount = (id) => {
    const dummyCounts = { '1': 5, '2': 2, '3': 12, '4': 0 };
    return dummyCounts[id] || 0;
  };

  const handleBookingSuccess = (ticketId) => {
    setSelectedService(null);
    navigate(`/track/${ticketId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white font-bold px-3 tracking-widest text-lg">
              ط
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">نظام الطوابير الذكي</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">الخدمات المتاحة</h2>
          <p className="text-lg text-gray-600">يرجى تحديد الخدمة أو القسم المطلوب لحجز موعدك في نظام الانتظار الإلكتروني الخاص بالمؤسسة.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dummyServices.map((service) => (
            <ServiceCard 
              key={service.id} 
              service={service} 
              waitingCount={getDummyWaitingCount(service.id)}
              onBook={setSelectedService}
            />
          ))}
        </div>
      </main>

      {selectedService && (
        <BookingModal 
          service={selectedService} 
          onClose={() => setSelectedService(null)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
};

export default Home;
