import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { triggerNotification } from '../lib/notifications';
import { 
  LayoutDashboard, 
  Settings, 
  History, 
  FileBarChart,
  BellRing, 
  CheckCircle, 
  Clock, 
  LogOut,
  Users,
  CheckSquare,
  Timer
} from 'lucide-react';

const _generateDummyTickets = () => {
  const services = ['شؤون الطلبة', 'القسم المالي', 'الدعم التقني'];
  const names = ['أحمد علي', 'سارة جاسم', 'محمد حسن', 'مريم إياد', 'فيصل عبدالرحمن', 'نورة سعد', 'خالد فهد', 'شهد ناصر', 'عبدالله تركي', 'حصة صالح'];
  const statuses = ['calling', 'waiting', 'waiting', 'skipped', 'waiting', 'waiting', 'calling', 'waiting', 'skipped', 'waiting'];
  
  return Array.from({ length: 10 }).map((_, i) => ({
    id: `dummy_${i}`,
    student_name: names[i],
    service_name: services[i % services.length],
    status: statuses[i],
    created_at: new Date(Date.now() - (15 - i) * 60000).toISOString(),
    isDummy: true
  }));
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('queue');
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [completedToday, setCompletedToday] = useState(42); 
  const [loading, setLoading] = useState(true);
  const [flashingTicketId, setFlashingTicketId] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');

  useEffect(() => {
    fetchActiveTickets();
    fetchServices();

    const channel = supabase
      .channel('public:tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchActiveTickets();
      })
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

    if (mappedReal.length === 0) {
      setTickets(_generateDummyTickets());
    } else {
      setTickets(mappedReal);
    }
    
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase.from('services').select('*');
    if (error) {
       console.error('Error fetching services:', error);
       return;
    }

    if (data && data.length > 0) {
      setServices(data);
    } else {
      setServices([
        { id: '1', service_name: 'شؤون الطلبة', estimated_duration_minutes: 10 },
        { id: '2', service_name: 'القسم المالي', estimated_duration_minutes: 15 },
        { id: '3', service_name: 'الدعم التقني', estimated_duration_minutes: 5 },
        { id: '4', service_name: 'خدمات المكتبة', estimated_duration_minutes: 8 }
      ]);
    }
  };

  const handleUpdateServiceDuration = async (id, newDuration) => {
    if (!newDuration || isNaN(newDuration)) return;
    
    // Attempt DB update
    await supabase
      .from('services')
      .update({ estimated_duration_minutes: newDuration })
      .eq('id', id);
      
    // Always update local state for demo purposes to reflect UI changes instantly
    setServices(prev => prev.map(s => s.id === id ? { ...s, estimated_duration_minutes: newDuration } : s));
  };

  const handleCallNext = async (ticket) => {
    setFlashingTicketId(ticket.id);
    
    // Trigger real Webhook / Notification wrapper
    await triggerNotification({
      event: 'call_next',
      ticket_id: ticket.id,
      student_name: ticket.student_name,
      message: 'جارٍ الاستدعاء'
    });

    if (!ticket.isDummy) {
      await supabase.from('tickets').update({ status: 'calling' }).eq('id', ticket.id);
    } else {
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'calling' } : t));
    }
    
    setTimeout(() => setFlashingTicketId(null), 3000); 
  };

  const handleComplete = async (ticket) => {
    if (!ticket.isDummy) {
      await supabase.from('tickets').update({ status: 'completed' }).eq('id', ticket.id);
    } else {
      setTickets(prev => prev.filter(t => t.id !== ticket.id));
    }
    setCompletedToday(c => c + 1);
  };

  const handleSnooze = async (ticket) => {
    await triggerNotification({
      event: 'snooze',
      ticket_id: ticket.id,
      student_name: ticket.student_name,
      message: 'تم التأجيل'
    });

    if (!ticket.isDummy) {
      await supabase.from('tickets').update({ 
        status: 'skipped', 
        created_at: new Date().toISOString() 
      }).eq('id', ticket.id);
    } else {
      setTickets(prev => {
        const remaining = prev.filter(t => t.id !== ticket.id);
        const snoozed = { ...ticket, status: 'skipped', created_at: new Date().toISOString() };
        return [...remaining, snoozed];
      });
    }
  };

  const getElapsedTime = (dateStr) => {
    const start = new Date(dateStr);
    const now = new Date();
    const diffMins = Math.floor((now - start) / 60000);
    return `${Math.max(0, diffMins)} دقيقة`;
  };

  const filteredTickets = tickets.filter(t => departmentFilter === 'all' || t.service_name === departmentFilter);
  // Distinct departments for filter drop down
  const departments = [...new Set(tickets.map(t => t.service_name))];

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex text-slate-900" dir="rtl">
      {/* Sidebar Layout */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col items-center py-8 shadow-2xl z-10 shrink-0">
        <div className="flex items-center gap-3 mb-12 text-white px-6 w-full">
          <div className="bg-indigo-600 rounded p-2 text-xl font-bold border border-indigo-500 shadow-sm">ط</div>
          <h1 className="text-xl font-bold tracking-wider">نظام الطوابير الذكي</h1>
        </div>
        
        <nav className="flex-1 w-full space-y-2 px-4">
          <SidebarNavButton 
            active={activeTab === 'queue'} 
            onClick={() => setActiveTab('queue')}
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="لوحة التحكم" 
          />
          <SidebarNavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="w-5 h-5" />} 
            label="إعدادات الأقسام" 
          />
          <SidebarNavButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History className="w-5 h-5" />} 
            label="سجل النشاط" 
          />
          <SidebarNavButton 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<FileBarChart className="w-5 h-5" />} 
            label="التقارير" 
          />
        </nav>

        <div className="mt-auto px-4 w-full">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-10 overflow-auto h-screen relative">
        {activeTab === 'queue' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">لوحة التحكم</h2>
                <p className="text-slate-500 mt-2">إدارة الطابور النشط، واستدعاء المراجعين، وإنجاز المعاملات.</p>
              </div>
                 
              <div className="flex items-center gap-3">
                 <select 
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm cursor-pointer"
                 >
                    <option value="all">كل الأقسام</option>
                    {departments.map((dep, i) => (
                        <option key={i} value={dep}>{dep}</option>
                    ))}
                 </select>
              </div>
            </header>

            {/* Top Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="إجمالي المنتظرين" 
                    value={tickets.length} 
                    icon={<Users className="w-8 h-8 text-blue-500" />} 
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard 
                    title="تمت خدمتهم" 
                    value={completedToday} 
                    icon={<CheckSquare className="w-8 h-8 text-emerald-500" />} 
                    color="bg-emerald-50 text-emerald-600"
                />
                <StatCard 
                    title="متوسط وقت الانتظار" 
                    value="12 دقيقة" 
                    icon={<Timer className="w-8 h-8 text-amber-500" />} 
                    color="bg-amber-50 text-amber-600"
                />
            </div>

            {/* Queue Table */}
            {loading ? (
              <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full"></div></div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-start whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                        <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">رقم الدور</th>
                        <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">اسم الطالب</th>
                        <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">نوع المعاملة</th>
                        <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">وقت الانتظار</th>
                        <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider">الحالة</th>
                        <th className="py-4 px-6 text-sm font-bold text-slate-600 tracking-wider text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredTickets.map((ticket, index) => (
                        <tr 
                            key={ticket.id} 
                            className={`transition-all duration-500 ${
                                flashingTicketId === ticket.id ? 'bg-green-50 ring-2 ring-emerald-400 ring-inset scale-[1.01]' : 
                                ticket.status === 'calling' ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                            }`}
                        >
                            <td className="py-4 px-6 font-semibold text-slate-800">
                                #{ticket.isDummy ? index + 1 : ticket.id.toString().slice(0, 5)}
                            </td>
                            <td className="py-4 px-6 text-slate-900 font-medium flex items-center gap-2">
                                {ticket.status === 'calling' && (
                                    <span className="relative flex h-3 w-3 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                )}
                                {ticket.student_name}
                            </td>
                            <td className="py-4 px-6 text-slate-600">{ticket.service_name}</td>
                            <td className="py-4 px-6 text-slate-600 font-medium">{getElapsedTime(ticket.created_at)}</td>
                            <td className="py-4 px-6">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold inline-block border ${
                                ticket.status === 'calling' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' :
                                ticket.status === 'skipped' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                {ticket.status === 'calling' ? 'جارٍ الاستدعاء' : ticket.status === 'skipped' ? 'متأخر' : 'في الانتظار'}
                            </span>
                            </td>
                            <td className="py-4 px-6">
                                <div className="flex justify-center gap-2">
                                <button 
                                    onClick={() => handleCallNext(ticket)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm cursor-pointer border border-indigo-100 hover:border-transparent text-sm font-semibold"
                                    title="استدعاء"
                                >
                                    <BellRing className="w-4 h-4" />
                                    استدعاء
                                </button>
                                <button 
                                    onClick={() => handleComplete(ticket)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm cursor-pointer border border-emerald-100 hover:border-transparent text-sm font-semibold"
                                    title="إنجاز"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    إنجاز
                                </button>
                                <button 
                                    onClick={() => handleSnooze(ticket)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-500 hover:text-white transition-all shadow-sm cursor-pointer border border-amber-100 hover:border-transparent text-sm font-semibold"
                                    title="تأجيل"
                                >
                                    <Clock className="w-4 h-4" />
                                    تأجيل
                                </button>
                                </div>
                            </td>
                        </tr>
                        ))}
                        {filteredTickets.length === 0 && (
                            <tr>
                                <td colSpan="6">
                                    <div className="py-16 text-center text-slate-400 font-medium flex flex-col items-center">
                                       <CheckCircle className="w-12 h-12 mb-3 text-slate-200" />
                                       لا توجد تذاكر نشطة في هذا القسم حالياً.
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                    </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">إعدادات الأقسام</h2>
            <div className="space-y-4">
              {services.map(s => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50 p-5 rounded-xl border border-slate-200 gap-4">
                     <span className="font-semibold text-lg text-slate-800">{s.service_name}</span>
                     <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                         <span className="text-sm font-medium text-slate-600">مدة الانتظار (دقائق):</span>
                         <input 
                            type="number"
                            min="1"
                            defaultValue={s.estimated_duration_minutes}
                            id={`duration-input-${s.id}`}
                            className="w-20 px-3 py-1.5 border border-slate-300 rounded-md text-center outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                         />
                         <button 
                            onClick={() => handleUpdateServiceDuration(s.id, parseInt(document.getElementById(`duration-input-${s.id}`).value))}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-sm cursor-pointer"
                          >
                            حفظ
                         </button>
                     </div>
                  </div>
              ))}
              {services.length === 0 && (
                  <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      جاري تحميل الأقسام أو لا توجد أقسام مسجلة...
                  </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in fade-in">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">سجل النشاط</h2>
            <div className="space-y-4">
              {[
                { time: 'قبل دقيقتين', text: 'أحمد علي تم استدعاؤه إلى شؤون الطلبة' },
                { time: 'قبل 5 دقائق', text: 'سارة جاسم تمت خدمة معاملتها بنجاح' },
                { time: 'قبل 15 دقيقة', text: 'مريم إياد تم تأجيل دورها' },
                { time: 'قبل 22 دقيقة', text: 'فيصل عبدالرحمن قام بحجز تذكرة في القسم المالي' },
                { time: 'قبل 30 دقيقة', text: 'نورة سعد تم استدعاؤها إلى الدعم التقني' }
              ].map((log, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-medium">{log.text}</p>
                    <span className="text-sm text-slate-500">{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="max-w-5xl mx-auto animate-in fade-in space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">التقارير والإحصائيات</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                 <p className="text-slate-500 font-semibold mb-3">القسم الأكثر ازدحاماً</p>
                 <h3 className="text-3xl font-black text-indigo-600">شؤون الطلبة</h3>
                 <p className="text-sm text-slate-400 mt-3 font-medium">12 تذكرة اليوم</p>
               </div>
               <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                 <p className="text-slate-500 font-semibold mb-3">متوسط وقت الخدمة الفعلي</p>
                 <h3 className="text-3xl font-black text-emerald-600">8 دقائق</h3>
                 <p className="text-sm text-emerald-500 mt-3 font-medium">أسرع بنسبة 15% من الأمس</p>
               </div>
               <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                 <p className="text-slate-500 font-semibold mb-3">عدد التذاكر الملغاة</p>
                 <h3 className="text-3xl font-black text-red-500">3 تذاكر</h3>
                 <p className="text-sm text-slate-400 mt-3 font-medium">بسبب عدم التواجد عند الاستدعاء</p>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const SidebarNavButton = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium ${
            active 
            ? 'bg-indigo-600 text-white shadow-md pointer-events-none' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
        {icon}
        <span className="text-sm tracking-wide">{label}</span>
    </button>
);

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-row-reverse items-center justify-between gap-5 shadow-sm hover:shadow-md transition-shadow">
        <div className={`p-4 rounded-full ${color.split(' ')[0]} ${color.split(' ')[1]}`}>
            {icon}
        </div>
        <div className="text-end">
            <p className="text-slate-500 text-sm font-bold mb-2 uppercase tracking-widest">{title}</p>
            <h3 className="text-4xl font-black text-slate-800">{value}</h3>
        </div>
    </div>
);

export default AdminDashboard;
