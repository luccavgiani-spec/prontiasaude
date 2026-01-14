import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, password, patient_id, role = 'admin' } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating admin user: ${email}`);

    // 1. Create user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        first_name: 'Suporte', 
        last_name: 'Prontia' 
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = authData.user.id;
    console.log(`Auth user created with ID: ${newUserId}`);

    // 2. If patient_id provided, update the patients record to use new auth user id
    if (patient_id) {
      // First, get the existing patient data
      const { data: existingPatient, error: fetchError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patient_id)
        .single();

      if (fetchError) {
        console.error('Error fetching patient:', fetchError);
      } else if (existingPatient) {
        // Delete old record and insert with new ID
        const { error: deleteError } = await supabase
          .from('patients')
          .delete()
          .eq('id', patient_id);

        if (deleteError) {
          console.error('Error deleting old patient record:', deleteError);
        } else {
          // Insert new record with auth user ID
          const { error: insertError } = await supabase
            .from('patients')
            .insert({
              ...existingPatient,
              id: newUserId,
              user_id: newUserId,
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Error inserting updated patient:', insertError);
          } else {
            console.log(`Patient record updated to use auth user ID: ${newUserId}`);
          }
        }
      }
    } else {
      // Create new patient record if none exists
      // CORREÇÃO: Remover 'id:' e usar apenas 'user_id' para upsert correto
      const { error: patientError } = await supabase
        .from('patients')
        .upsert({
          user_id: newUserId,
          email: email,
          first_name: 'Suporte',
          last_name: 'Prontia',
          profile_complete: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (patientError) {
        console.error('Error creating patient record:', patientError);
      }
    }

    // 3. Add role to user_roles
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: role
      });

    if (roleError) {
      console.error('Error adding role:', roleError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: newUserId,
          warning: `User created but role assignment failed: ${roleError.message}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Role '${role}' assigned to user ${newUserId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: newUserId,
        email: email,
        role: role,
        message: 'Admin user created successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
