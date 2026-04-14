import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Bell, MapPin, Clock, AlertTriangle } from 'lucide-react';

const Track = () => {
  const { ticketId: paramTicketId } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [service, setService] = useState(null);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Audio context for the beep sound
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const id = paramTicketId || localStorage.getItem('ticket_id');
    if (!id) {
      navigate('/');
      return;
    }

    fetchTicketData(id);

    // Setup real-time listener for the user's specific ticket
    const ticketSubscription = supabase
      .channel(`ticket-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, payload => {
        setTicket(payload.new);
        if (payload.new.status === 'calling') {
          playBeep();
        }
      })
      .subscribe();

    // Setup general listener for queue updates to recalculate position
    const queueSubscription = supabase
      .channel(`queue-updates`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
        if (ticket && ticket.service_id) {
          calculatePosition(ticket.service_id, ticket.created_at);
        }
      })
      .subscribe();

    // Poll to keep queue fresh just in case
    const interval = setInterval(() => {
      if (ticket && ticket.service_id) {
         calculatePosition(ticket.service_id, ticket.created_at);
      }
    }, 10000);

    return () => {
      supabase.removeChannel(ticketSubscription);
      supabase.removeChannel(queueSubscription);
      clearInterval(interval);
    };
  }, [paramTicketId, navigate, ticket?.service_id]);

  const fetchTicketData = async (id) => {
    setLoading(true);
    try {
      // 1. Fetch Ticket
      const { data: tData, error: tError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (tError) throw tError;
      setTicket(tData);

      // 2. Fetch Service
      const { data: sData, error: sError } = await supabase
        .from('services')
        .select('*')
        .eq('id', tData.service_id)
        .single();
        
      if (sError) throw sError;
      setService(sData);

      // 3. Calculate initial position
      await calculatePosition(tData.service_id, tData.created_at);

      if (tData.status === 'calling') {
        playBeep();
      }

    } catch (err) {
      console.error(err);
      setError('Ticket not found.');
      localStorage.removeItem('ticket_id');
    } finally {
      setLoading(false);
    }
  };

  const calculatePosition = async (serviceId, createdAt) => {
    const { data, error } = await supabase
      .from('tickets')
      .select('id')
      .eq('service_id', serviceId)
      .in('status', ['waiting', 'calling'])
      .lt('created_at', createdAt);
      
    if (!error && data) {
      setPosition(data.length); 
    }
  };

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.log('Audio disabled or failed', e);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-sm w-full">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Ticket</h2>
          <p className="text-gray-500 mb-6">We couldn't find your ticket.</p>
          <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg py-2 w-full">Back to Home</button>
        </div>
      </div>
    );
  }

  const estWaitTime = position * (service?.estimated_duration_minutes || 0);

  return (
    <div className={`min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-500 ${ticket.status === 'calling' ? 'bg-indigo-600' : 'bg-gray-50'}`}>
      
      <div className={`max-w-md w-full rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${ticket.status === 'calling' ? 'bg-white scale-105' : 'bg-white'}`}>
        <div className="p-6 text-center border-b border-gray-100">
          <h2 className="text-sm font-semibold tracking-widest text-gray-400 uppercase mb-1">Live Ticket</h2>
          <h1 className="text-2xl font-bold text-gray-900">{ticket.student_name}</h1>
          <p className="text-indigo-600 font-medium">{service?.service_name}</p>
        </div>

        <div className="p-8 pb-10">
          {ticket.status === 'calling' && (
            <div className="text-center animate-pulse">
              <Bell className="w-20 h-20 text-indigo-600 mx-auto mb-4 drop-shadow-md" />
              <h2 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">IT'S YOUR TURN!</h2>
              <p className="text-xl text-gray-600 font-medium font-semibold">Please head to the office now.</p>
            </div>
          )}

          {ticket.status === 'waiting' && (
            <div className="text-center space-y-8">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">People Ahead of You</p>
                <div className="text-6xl font-black text-gray-900 tracking-tighter">
                  {position}
                </div>
              </div>
              
              <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex items-center justify-center gap-3">
                <Clock className="w-6 h-6 text-indigo-500" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Estimated Wait</p>
                  <p className="text-xl font-bold text-indigo-900">{estWaitTime} mins</p>
                </div>
              </div>
            </div>
          )}

          {ticket.status === 'skipped' && (
            <div className="text-center">
              <div className="bg-yellow-100 p-4 rounded-full inline-block mb-4">
                <MapPin className="w-10 h-10 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">You were skipped</h2>
              <p className="text-gray-600">You are back in the queue. Please be attentive!</p>
            </div>
          )}
          
          {ticket.status === 'completed' && (
             <div className="text-center">
             <div className="bg-green-100 p-4 rounded-full inline-block mb-4">
               <MapPin className="w-10 h-10 text-green-600" />
             </div>
             <h2 className="text-2xl font-bold text-gray-900 mb-2">Service Completed</h2>
             <p className="text-gray-600">Thank you for using our smart queue system.</p>
           </div>
          )}
        </div>
      </div>
      
      {ticket.status !== 'completed' && (
        <button 
          onClick={() => {
            localStorage.removeItem('ticket_id');
            navigate('/');
          }} 
          className={`mt-8 font-medium ${ticket.status === 'calling' ? 'text-indigo-200 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Cancel Ticket & Return Home
        </button>
      )}

      {ticket.status === 'completed' && (
        <button 
          onClick={() => {
            localStorage.removeItem('ticket_id');
            navigate('/');
          }} 
          className="mt-8 font-medium text-gray-500 hover:text-gray-900 bg-white px-6 py-2 rounded-full shadow-sm"
        >
          Return Home
        </button>
      )}
    </div>
  );
};

export default Track;
