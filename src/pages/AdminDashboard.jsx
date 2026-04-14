import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { triggerNotification } from '../lib/notifications';
import { 
  LayoutDashboard, 
  Settings, 
  History, 
  BellRing, 
  CheckCircle, 
  Clock, 
  LogOut 
} from 'lucide-react';

const _generateDummyTickets = () => {
  const services = ['شؤون الطلبة', 'القسم المالي', 'الدعم التقني'];
  const names = ['أحمد محمد', 'فاطمة علي', 'سالم عبدالله', 'عائشة سعيد', 'طارق منصور'];
  
  return Array.from({ length: 10 }).map((_, i) => ({
    id: `dummy_${i}`,
    student_name: names[i % names.length] + ` (${i + 1})`,
    service_name: services[i % services.length],
    status: i === 0 ? 'calling' : 'waiting',
    created_at: new Date(Date.now() - (10 - i) * 60000).toISOString(),
    isDummy: true
  }));
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('queue');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flashingTicketId, setFlashingTicketId] = useState(null);

  useEffect(() => {
    fetchActiveTickets();

    const channel = supabase
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchActiveTickets)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveTickets = async () => {
    setLoading(true);
    const { data: realTickets, error } = await supabase
      .from('tickets')
      .select('*, services(service_name, estimated_duration_minutes)')
      .in('status', ['waiting', 'calling', 'skipped'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tickets:', error);
      setLoading(false);
      return;
    }

    let mappedReal = [];
    if (realTickets && realTickets.length > 0) {
      mappedReal = realTickets.map(t => ({
        ...t,
        service_name: t.services?.service_name || 'خدمة عامة',
        isDummy: false
      }));
    }

    // Merge logic: If empty or less than 3, inject dummies to make it look full for demo
    if (mappedReal.length === 0) {
      setTickets(_generateDummyTickets());
    } else {
      const dummyPad = _generateDummyTickets().slice(0, Math.max(0, 10 - mappedReal.length));
      setTickets([...mappedReal, ...dummyPad]);
    }
    
    setLoading(false);
  };

  const handleCallNext = async (ticket) => {
    setFlashingTicketId(ticket.id);
    
    // Webhook Notification
    await triggerNotification({
      event: 'call_next',
      ticket_id: ticket.id,
      student_name: ticket.student_name,
      message: 'Status: Your Turn'
    });

    if (!ticket.isDummy) {
      await supabase.from('tickets').update({ status: 'calling' }).eq('id', ticket.id);
    } else {
      // Simulate real-time dummy update
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'calling' } : t));
    }
    
    setTimeout(() => setFlashingTicketId(null), 3000); // 3 seconds pulsing green
  };

  const handleComplete = async (ticket) => {
    if (!ticket.isDummy) {
      await supabase.from('tickets').update({ status: 'completed' }).eq('id', ticket.id);
    } else {
      setTickets(prev => prev.filter(t => t.id !== ticket.id));
    }
  };

  const handleSnooze = async (ticket) => {
    await triggerNotification({
      event: 'snooze',
      ticket_id: ticket.id,
      student_name: ticket.student_name,
      message: 'Status: Delayed'
    });

    if (!ticket.isDummy) {
      // Move to back of the line by updating created_at
      await supabase.from('tickets').update({ 
        status: 'skipped', 
        created_at: new Date().toISOString() 
      }).eq('id', ticket.id);
    } else {
      // Simulate snooze internally
      setTickets(prev => {
        const remaining = prev.filter(t => t.id !== ticket.id);
        const snoozed = { ...ticket, status: 'skipped', created_at: new Date().toISOString() };
        return [...remaining, snoozed];
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex text-gray-900" dir="rtl">
      {/* Sidebar Layout */}
      <aside className="w-64 bg-[#0f172a] text-gray-300 flex flex-col items-center py-8 shadow-xl">
        <div className="flex items-center gap-3 mb-12 text-white px-6 w-full">
          <div className="bg-indigo-500 rounded p-2 text-xl font-bold">ط</div>
          <h1 className="text-xl font-bold tracking-wider">لوحة التحكم</h1>
        </div>
        
        <nav className="flex-1 w-full space-y-2 px-4">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'queue' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">الطابور الحالي</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">إعدادات الخدمات</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <History className="w-5 h-5" />
            <span className="font-medium">السجل</span>
          </button>
        </nav>

        <div className="mt-auto px-4 w-full">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 lg:p-12 overflow-auto bg-slate-50">
        {activeTab === 'queue' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex justify-between items-end mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">إدارة الطابور النشط</h2>
                <p className="text-slate-500 mt-2">تحكم بحركة الطلاب، استدعاء المراجعين، وإنجاز المهام فورياً.</p>
              </div>
              <div className="bg-white px-5 py-2 rounded-full shadow-sm border border-slate-200 text-sm font-semibold text-slate-600">
                إجمالي التذاكر: {tickets.length}
              </div>
            </header>

            {loading ? (
              <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full"></div></div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-start">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">رقم الدور</th>
                      <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">اسم الطالب</th>
                      <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">الخدمة</th>
                      <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">الحالة</th>
                      <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tickets.map((ticket, index) => (
                      <tr 
                        key={ticket.id} 
                        className={`transition-all duration-300 ${flashingTicketId === ticket.id ? 'bg-green-50 ring-2 ring-green-400 ring-inset scale-[1.01]' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-4 px-6 font-semibold text-slate-700">#{index + 1}</td>
                        <td className="py-4 px-6 text-slate-900 font-medium">
                          {ticket.student_name}
                          {ticket.isDummy && <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full mr-2">وهمي</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-500">{ticket.service_name}</td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            ticket.status === 'calling' ? 'bg-green-100 text-green-700' :
                            ticket.status === 'skipped' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {ticket.status === 'calling' ? 'جاري الاستدعاء' : ticket.status === 'skipped' ? 'تم التأجيل' : 'في الانتظار'}
                          </span>
                        </td>
                        <td className="py-4 px-6 flex justify-center gap-2">
                          <button 
                            onClick={() => handleCallNext(ticket)}
                            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white p-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                            title="استدعاء التالي"
                          >
                            <BellRing className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleComplete(ticket)}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white p-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                            title="إنجاز المهمة"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleSnooze(ticket)}
                            className="bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white p-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                            title="تأجيل للتالي"
                          >
                            <Clock className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tickets.length === 0 && (
                  <div className="p-12 text-center text-slate-400 font-medium">
                    لا يوجد طابور نشط حالياً.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">إعدادات الخدمات</h2>
            <div className="text-slate-500 py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              واجهة التحكم بتعديل مدد الانتظار للخدمات قيد الإنشاء...
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">سجل الإنجازات</h2>
            <div className="text-slate-500 py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
              تصفح التذاكر المنجزة اليوم - قيد الإنشاء...
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
