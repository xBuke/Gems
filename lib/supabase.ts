import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vxtkajyxyijleqiznnxr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dGthanl4eWlqbGVxaXpubnhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjUzNjksImV4cCI6MjA5NzMwMTM2OX0.tULC8b9D6CIKxYli-o5Xxanrt3WeiyGnLrHyung_6bk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
