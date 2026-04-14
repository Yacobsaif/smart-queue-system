import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { triggerNotification } from '../lib/notifications';
import { Settings, Play, CheckCircle, Clock } from 'lucide-react';

const Admin = () => {
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();

    const ticketsSub = supabase
      .channel('admin-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    const servicesSub = supabase
      .channel('admin-services')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => {
        fetchServices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsSub);
      supabase.removeChannel(servicesSub);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTickets(), fetchServices()]);
    setLoading(false);
  };

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, services(service_name)')
      .in('status', ['waiting', 'calling', 'skipped'])
      .order('created_at', { ascending: true });
    
    if (!error) setTickets(data);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('service_name');
      
    if (!error) setServices(data);
  };

  const updateTicketStatus = async (id, status, isSnooze = false) => {
    if (updating) return;
    setUpdating(true);
    
    const updates = { status };
    if (isSnooze) {
      updates.created_at = new Date().toISOString();
    }

    await supabase.from('tickets').update(updates).eq('id', id);
    setUpdating(false);
    
    const targetTicket = tickets.find(t => t.id === id);
    if (targetTicket) {
      if (status === 'calling') {
        triggerNotification({
          event: 'call_next',
          student_email: targetTicket.student_email,
          message: 'Status: Your Turn'
        });
      } else if (status === 'skipped') {
        triggerNotification({
          event: 'snooze',
          student_email: targetTicket.student_email,
          message: 'Status: Delayed'
        });
      }
    }
    
    fetchTickets(); // Optimistic refetch or wait for unsubscription
  };

  const updateServiceDuration = async (id, newDuration) => {
    await supabase.from('services').update({ estimated_duration_minutes: newDuration }).eq('id', id);
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex pb-10">
      {/* Sidebar for Services / Settings */}
      <div className="w-80 bg-white shadow-lg border-r border-gray-200 p-6 hidden md:block">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-gray-500" />
          Queue Settings
        </h2>
        
        <div className="space-y-6">
          {services.map(service => (
            <div key={service.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-2">{service.service_name}</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Duration (mins)</span>
                <input 
                  type="number"
                  min="1"
                  defaultValue={service.estimated_duration_minutes}
                  onBlur={(e) => updateServiceDuration(service.id, parseInt(e.target.value))}
                  className="w-20 text-center px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Dashboard */}
      <div className="flex-1 p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8 border-b pb-4">Staff Dashboard</h1>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-6 gap-4 p-4 font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 text-sm tracking-wider uppercase">
            <div className="col-span-1">Ticket ID #</div>
            <div className="col-span-1">Student</div>
            <div className="col-span-1">Service</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          
          {tickets.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No active tickets found.</div>
          ) : (
             <div className="divide-y divide-gray-100">
              {tickets.map((ticket, index) => (
                <div key={ticket.id} className={`grid grid-cols-6 gap-4 p-4 items-center transition-colors ${ticket.status === 'calling' ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                  <div className="col-span-1 font-mono text-sm text-gray-500">{ticket.id.toString().slice(0, 8)}...</div>
                  <div className="col-span-1 font-semibold text-gray-900">
                    {ticket.student_name}
                    <div className="text-xs text-gray-500 font-normal">{ticket.student_email}</div>
                  </div>
                  <div className="col-span-1 text-gray-600">{ticket.services?.service_name}</div>
                  <div className="col-span-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      ticket.status === 'calling' ? 'bg-indigo-100 text-indigo-800 border-indigo-200 animate-pulse' :
                      ticket.status === 'skipped' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-green-100 text-green-800 border-green-200'
                    }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    {ticket.status !== 'calling' && (
                      <button 
                        onClick={() => updateTicketStatus(ticket.id, 'calling')}
                        disabled={updating}
                        className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Call Next
                      </button>
                    )}
                    
                    {ticket.status === 'calling' && (
                      <button 
                        onClick={() => updateTicketStatus(ticket.id, 'completed')}
                        disabled={updating}
                        className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </button>
                    )}

                    <button 
                      onClick={() => updateTicketStatus(ticket.id, 'skipped', true)}
                      disabled={updating}
                      className="flex items-center px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Snooze
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
