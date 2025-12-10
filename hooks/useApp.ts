import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { apiClient } from '../apiClient';
import { Unit, UserProgress, KnowledgeItem } from '../types';
import { INITIAL_UNITS } from '../constants';

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, authLoading };
};

export const useAdminStatus = (session: Session | null) => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!session?.user?.email) {
        setIsAdmin(false);
        return;
      }

      // --- HARDCODED SUPER ADMIN CHECK ---
      if (session.user.email === 'admin@labzoon.com') {
        setIsAdmin(true);
        return; 
      }
      
      // Check DB via API for admin email
      try {
        const admins = await apiClient.fetchAdmins();
        const isAdminUser = admins.some((admin: any) => admin.email === session.user.email);
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      }
    };
    
    if (session) {
      checkAdmin();
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  return isAdmin;
};

export const useUserData = (session: Session | null) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress>({});
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);

  useEffect(() => {
    if (!session) return;

    const loadUserData = async () => {
      try {
        // Load units and progress
        const { data: unitsData, error: unitsError } = await supabase.from('units').select('*').order('order_index');
        if (unitsError) {
          console.error('Error loading units:', unitsError);
          return;
        }

        if (!unitsData || unitsData.length === 0) {
          console.log('No units found in database, using initial units');
          const insertedUnits = [];
          for (const unit of INITIAL_UNITS) {
            const { data, error } = await supabase.from('units').insert([unit]).select();
            if (error) {
              console.error('Error inserting unit:', error);
            } else if (data) {
              insertedUnits.push(data[0]);
            }
          }
          setUnits(insertedUnits);
        } else {
          setUnits(unitsData);
        }

        // Load user progress
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', session.user.id);

        if (progressData) {
          const progress: UserProgress = {};
          progressData.forEach(item => {
            progress[item.lesson_id] = {
              completed: item.completed,
              score: item.score,
              stars: item.stars,
              attempts: item.attempts,
              last_attempt: item.last_attempt
            };
          });
          setUserProgress(progress);
        }

        // Load knowledge items
        const { data: knowledgeData } = await supabase
          .from('knowledge_items')
          .select('*')
          .order('created_at', { ascending: false });

        if (knowledgeData) {
          setKnowledgeItems(knowledgeData);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [session]);

  return { units, userProgress, knowledgeItems, setUnits, setUserProgress, setKnowledgeItems };
};