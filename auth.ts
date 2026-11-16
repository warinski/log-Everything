import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('--- AUTH DEBUG: Authorize called with email:', credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log('--- AUTH DEBUG: Missing email or password ---');
          return null; // Return null instead of throwing so NextAuth handles it cleanly
        }

        try {
          await dbConnect();
          const user = await User.findOne({ email: credentials.email });

          if (!user) {
            console.log('--- AUTH DEBUG: User not found in database for email:', credentials.email);
            return null;
          }

          if (!user.password) {
            console.log('--- AUTH DEBUG: User record has no password stored ---');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          console.log('--- AUTH DEBUG: Password validation result:', isPasswordValid);

          if (!isPasswordValid) {
            console.log('--- AUTH DEBUG: Password does not match ---');
            return null;
          }

          console.log('--- AUTH DEBUG: Authentication success for:', user.email);
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          };
        } catch (error) {
          console.error('--- AUTH DEBUG: Error in authorize function:', error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
});