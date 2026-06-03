"use client";

import React, { useState, useEffect } from "react";
import { getMe } from "@/src/api/auth.api";
import * as RolesAPI from "@/src/api/roles.api";
import { Building2, Mail, Phone, Shield, CheckCircle, XCircle, Clock, Bell, User as UserIcon } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [roleName, setRoleName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await getMe();
        setUser(userData);

        // Fetch role name
        let roles: { id: number, name: string }[] = [];
        if (userData.role?.id === 50) {
          try {
            const rolesData = await RolesAPI.listRoles({ limit: 100 });
            roles = Array.isArray(rolesData) ? rolesData : rolesData.data || [];
          } catch (err) {
            console.warn('Failed to fetch roles:', err);
          }
        }
        
        const role = roles.find(r => r.id === userData.role?.id);
        const roleNames: Record<number, string> = {
          50: 'Системный администратор',
          40: 'Руководство',
          30: 'Отдел контроля',
          20: 'Операционный отдел',
          10: 'Отдел продаж',
        };
        setRoleName(role?.name || userData.role?.legacy_name || roleNames[userData.role?.id || 0] || 'Пользователь');
      } catch (error) {
        console.error("Failed to fetch user data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-600">Не удалось загрузить данные профиля</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Профиль пользователя</h1>
        <p className="text-slate-600 mt-2">Информация о вашей учетной записи</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="gradient-primary p-6 text-white">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user.full_name?.[0] || user.legacy?.company_name?.[0] || user.email?.[0] || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.full_name || user.legacy?.company_name || 'Не указано'}</h2>
              <p className="text-white/80">{user.email}</p>
              {user.position && <p className="text-white/70 text-sm">{user.position}</p>}
              <div className="flex items-center mt-2 space-x-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">{roleName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Personal Info */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
              Личная информация
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-600 mb-1">ФИО</p>
                <p className="font-semibold text-slate-900">{user.full_name || 'Не указано'}</p>
              </div>
              {user.position && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-600 mb-1">Должность</p>
                  <p className="font-semibold text-slate-900">{user.position}</p>
                </div>
              )}
              {user.branch && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-600 mb-1">Филиал</p>
                  <p className="font-semibold text-slate-900">{user.branch.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Company Info (Legacy) */}
          {user.legacy && (user.legacy.company_name || user.legacy.bin_iin) && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                Информация о компании
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.legacy.company_name && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-600 mb-1">Название компании</p>
                    <p className="font-semibold text-slate-900">{user.legacy.company_name}</p>
                  </div>
                )}
                {user.legacy.bin_iin && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-600 mb-1">БИН/ИИН</p>
                    <p className="font-semibold text-slate-900">{user.legacy.bin_iin}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
              Контактная информация
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-600 mb-1 flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-slate-400" />
                  Email
                </p>
                <p className="font-semibold text-slate-900">{user.email}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-600 mb-1 flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-slate-400" />
                  Телефон
                </p>
                <p className="font-semibold text-slate-900">{user.phone || 'Не указан'}</p>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Статус верификации
            </h3>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {user.is_verified ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                  <span className="font-semibold text-slate-900">
                    {user.is_verified ? 'Верифицирован' : 'Не верифицирован'}
                  </span>
                </div>
                {user.verified_at && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(user.verified_at).toLocaleDateString('ru-RU')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Telegram Settings */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-blue-600" />
              Настройки Telegram
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-600 mb-1">Chat ID</p>
                <p className="font-semibold text-slate-900">
                  {user.telegram?.chat_id ? user.telegram.chat_id : 'Не подключен'}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-600 mb-1">Уведомления о задачах</p>
                <p className="font-semibold text-slate-900">
                  {user.telegram?.notify_tasks ? 'Включены' : 'Выключены'}
                </p>
              </div>
            </div>
          </div>

          {/* User ID */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-sm text-slate-600 mb-1">ID пользователя</p>
            <p className="font-semibold text-slate-900 font-mono">{user.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
