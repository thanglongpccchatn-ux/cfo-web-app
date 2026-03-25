import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Camera, 
  CloudRain, 
  Sun, 
  Cloud, 
  Users, 
  X, 
  Check, 
  Plus,
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react';

const SiteDiary = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // Form States
    const [weather, setWeather] = useState('Sunny');
    const [notes, setNotes] = useState('');
    const [laborCount, setLaborCount] = useState(0);
    const [issues, setIssues] = useState('');
    const [images, setImages] = useState([]); // Base64 or Blob for preview
    const [fileObjects, setFileObjects] = useState([]); // Actual files to upload

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .eq('status', 'Đang thực hiện');
            
            if (error) throw error;
            setProjects(data || []);
            if (data?.length > 0) setSelectedProject(data[0].id);
        } catch (error) {
            console.error("Error fetching projects:", error);
            addToast('Lỗi tải danh sách dự án', 'ERROR');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + images.length > 5) {
            addToast('Tối đa 5 ảnh mỗi nhật ký', 'WARNING');
            return;
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => [...prev, reader.result]);
                setFileObjects(prev => [...prev, file]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setFileObjects(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProject) {
            addToast('Vui lòng chọn dự án', 'WARNING');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Insert Diary Entry
            const { data: diary, error: dError } = await supabase
                .from('site_diary')
                .insert([{
                    project_id: selectedProject,
                    user_id: user.id,
                    weather,
                    progress_notes: notes,
                    labor_count: laborCount,
                    issues,
                    report_date: new Date().toISOString().split('T')[0]
                }])
                .select()
                .single();

            if (dError) throw dError;

            // 2. Upload Images if any
            if (fileObjects.length > 0) {
                for (const file of fileObjects) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${diary.id}/${Math.random()}.${fileExt}`;
                    const filePath = `diary_images/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('site-diaries')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.error("Upload error:", uploadError);
                        continue;
                    }

                    // Insert image record
                    await supabase
                        .from('site_diary_images')
                        .insert([{
                            diary_id: diary.id,
                            storage_path: filePath
                        }]);
                }
            }

            addToast('Đã gửi nhật ký thành công!', 'SUCCESS');
            // Reset Form
            setNotes('');
            setIssues('');
            setLaborCount(0);
            setImages([]);
            setFileObjects([]);
        } catch (error) {
            console.error("Submit error:", error);
            addToast('Lỗi khi gửi nhật ký: ' + error.message, 'ERROR');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto pb-20 p-4">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="text-blue-600" />
                    Nhật ký Hiện trường
                </h1>
                <p className="text-gray-500">Báo cáo hoạt động thi công hàng ngày</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Project Selection */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dự án thi công</label>
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="w-full p-3 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-lg font-medium"
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* Quick Weather Selection */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3 text-center uppercase tracking-wider">Thời tiết hôm nay</label>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { id: 'Sunny', icon: Sun, label: 'Nắng', color: 'text-orange-500 bg-orange-50' },
                            { id: 'Cloudy', icon: Cloud, label: 'Nhiều mây', color: 'text-blue-400 bg-blue-50' },
                            { id: 'Rainy', icon: CloudRain, label: 'Mưa', color: 'text-indigo-500 bg-indigo-50' }
                        ].map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setWeather(item.id)}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                    weather === item.id 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-transparent bg-gray-50'
                                }`}
                            >
                                <item.icon className={`w-8 h-8 ${item.color.split(' ')[0]} mb-2`} />
                                <span className="text-xs font-semibold">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Progress Notes */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nội dung thi công chính</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Hôm nay đã làm được những gì..."
                        className="w-full p-4 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                    />
                </div>

                {/* Quick Stats: Labor */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Users className="text-gray-400" />
                        <span className="font-medium">Số lượng nhân công:</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => setLaborCount(Math.max(0, laborCount - 1))}
                            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
                        >
                            <span className="text-2xl font-bold text-gray-600">-</span>
                        </button>
                        <span className="text-2xl font-bold w-12 text-center">{laborCount}</span>
                        <button 
                            type="button" 
                            onClick={() => setLaborCount(laborCount + 1)}
                            className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center active:scale-90 transition-transform"
                        >
                            <span className="text-2xl font-bold">+</span>
                        </button>
                    </div>
                </div>

                {/* Image Capture */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-sm font-medium text-gray-700">Hình ảnh hiện trường</label>
                        <span className="text-xs text-gray-400">{images.length}/5 ảnh</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        {images.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100">
                                <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        
                        {images.length < 5 && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current.click()}
                                className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 text-gray-400 active:bg-blue-50 active:border-blue-200 transition-colors"
                            >
                                <Camera className="w-8 h-8 mb-1" />
                                <span className="text-[10px] font-bold">CHỤP ẢNH</span>
                            </button>
                        )}
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        accept="image/*" 
                        multiple 
                        capture="environment" // Hint for mobile camera
                        className="hidden" 
                    />
                </div>

                {/* Issues/Difficulties */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="text-orange-500 w-4 h-4" />
                        <label className="text-sm font-medium text-gray-700">Vướng mắc/Khó khăn</label>
                    </div>
                    <textarea
                        value={issues}
                        onChange={(e) => setIssues(e.target.value)}
                        placeholder="Nêu các khó khăn cần giải quyết (nếu có)..."
                        className="w-full p-4 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={submitting}
                    className={`fixed bottom-4 left-4 right-4 p-4 rounded-2xl text-white font-bold text-lg shadow-xl shadow-blue-200 flex items-center justify-center gap-2 transform active:scale-95 transition-all ${
                        submitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            ĐANG GỬI...
                        </>
                    ) : (
                        <>
                            <Check className="w-6 h-6" />
                            GỬI NHẬT KÝ
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default SiteDiary;
