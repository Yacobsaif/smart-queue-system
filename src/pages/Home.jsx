import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ServiceCard from '../components/ServiceCard';
import BookingModal from '../components/BookingModal';
import { LayoutDashboard } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    fetchInitialData();
    
    // Subscribe to realtime changes in tickets to update dynamically
    const ticketsSubscription = supabase
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        // Optimistic update for better UX
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsSubscription);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchServices(), fetchTickets()]);
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase.from('services').select('*');
    if (error) console.error('Error fetching services:', error);
    else setServices(data || []);
  };

  const fetchTickets = async () => {
    // Only fetch tickets that affect waiting time
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .in('status', ['waiting', 'calling']);
      
    if (error) console.error('Error fetching tickets:', error);
    else setTickets(data || []);
  };

  const calculateWaitingCount = (serviceId) => {
    return tickets.filter(ticket => ticket.service_id === serviceId).length;
  };

  const handleBookingSuccess = (ticket) => {
    setSelectedService(null);
    navigate(`/track/${ticket.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Smart Queue Services</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-tight">Select a Service</h2>
          <p className="text-lg text-gray-600">Choose the department or service you need assistance with. Secure your spot in the virtual queue seamlessly.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-lg mx-auto">
            No services currently available. Please check back later.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map(service => (
              <ServiceCard 
                key={service.id} 
                service={service} 
                waitingCount={calculateWaitingCount(service.id)}
                onBook={setSelectedService}
              />
            ))}
          </div>
        )}
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
