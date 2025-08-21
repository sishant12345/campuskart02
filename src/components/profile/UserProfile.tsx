import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../config/firebase';
import { ref, get, update } from 'firebase/database';
import { User, Item } from '../../types';
import { MapPin, GraduationCap, Package, Mail, Phone, UserPlus, UserMinus } from 'lucide-react';
import BackButton from '../common/BackButton';

export const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, userData } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followerUsers, setFollowerUsers] = useState<Array<User & { id: string }>>([]);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchUserItems();
      checkFollowStatus();
    }
  }, [userId, userData]);

  const fetchUserProfile = async () => {
    if (!userId) return;
    
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        setProfileUser(snapshot.val());
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const openFollowers = async () => {
    if (!profileUser?.followers || profileUser.followers.length === 0) {
      setFollowerUsers([]);
      setFollowersOpen(true);
      return;
    }
    setFollowersLoading(true);
    setFollowersOpen(true);
    try {
      const usersRef = ref(database, 'users');
      const snap = await get(usersRef);
      if (snap.exists()) {
        const allUsers = snap.val() as Record<string, any>;
        const list = Object.entries(allUsers)
          .filter(([uid]) => profileUser.followers!.includes(uid))
          .map(([id, u]) => ({ id, ...(u as User) }));
        setFollowerUsers(list);
      } else {
        setFollowerUsers([]);
      }
    } catch (e) {
      console.error('Error loading followers:', e);
      setFollowerUsers([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  const fetchUserItems = async () => {
    if (!userId) return;
    
    try {
      const itemsRef = ref(database, 'items');
      const snapshot = await get(itemsRef);
      
      if (snapshot.exists()) {
        const allItems = snapshot.val();
        const userItemsList = Object.entries(allItems)
          .filter(([_, item]: [string, any]) => item.sellerId === userId)
          .map(([id, item]: [string, any]) => ({ id, ...item }))
          .sort((a: any, b: any) => {
            // Available first, then sold by soldAt desc
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            if (!a.isActive && !b.isActive) return (b.soldAt || 0) - (a.soldAt || 0);
            return 0;
          });
        
        setUserItems(userItemsList);
      }
    } catch (error) {
      console.error('Error fetching user items:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = () => {
    if (userData && userId && userData.following) {
      setIsFollowing(userData.following.includes(userId));
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !userData || !profileUser || !userId) return;
    
    setFollowLoading(true);
    
    try {
      const currentUserFollowing = userData.following || [];
      const profileUserFollowers = profileUser.followers || [];
      
      let updatedFollowing: string[];
      let updatedFollowers: string[];
      
      if (isFollowing) {
        // Unfollow
        updatedFollowing = currentUserFollowing.filter(id => id !== userId);
        updatedFollowers = profileUserFollowers.filter(id => id !== currentUser.uid);
      } else {
        // Follow
        updatedFollowing = [...currentUserFollowing, userId];
        updatedFollowers = [...profileUserFollowers, currentUser.uid];
      }
      
      // Update current user's following list
      const currentUserRef = ref(database, `users/${currentUser.uid}`);
      await update(currentUserRef, { following: updatedFollowing });
      
      // Update profile user's followers list
      const profileUserRef = ref(database, `users/${userId}`);
      await update(profileUserRef, { followers: updatedFollowers });
      
      setIsFollowing(!isFollowing);
      setProfileUser(prev => prev ? { ...prev, followers: updatedFollowers } : null);
      
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading || !profileUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === userId;

  return (
    <>
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton toHomeFallback="/teammates" />
        </div>
        
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Profile Photo */}
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              {profileUser.profilePhoto ? (
                <img 
                  src={profileUser.profilePhoto} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-4xl font-bold text-gray-400">
                  {profileUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{profileUser.name}</h1>
                {!isOwnProfile && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isFollowing
                        ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-300'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 focus:ring-blue-600'
                    } disabled:opacity-50`}
                  >
                    {followLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Follow
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {profileUser.bio && (
                <p className="text-gray-600 mb-4">{profileUser.bio}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{profileUser.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{profileUser.mobile}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  <span>{profileUser.college}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{profileUser.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{userItems.length}</div>
              <div className="text-sm text-gray-600">Items Posted</div>
            </div>
            <button
              type="button"
              onClick={openFollowers}
              className="text-center cursor-pointer focus:outline-none rounded-xl p-3 hover:bg-gray-50 transition"
              aria-label="View followers"
            >
              <div className="text-2xl font-bold text-gray-900">{profileUser.followers?.length || 0}</div>
              <div className="text-sm text-gray-600">Followers</div>
            </button>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{profileUser.following?.length || 0}</div>
              <div className="text-sm text-gray-600">Following</div>
            </div>
          </div>
        </div>

    {/* Posted Items */}
    <div className="bg-white rounded-2xl shadow-sm border p-8">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Package className="h-6 w-6" />
        Posted Items
      </h2>

      {userItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items posted</h3>
          <p className="text-gray-600">{profileUser.name} hasn't posted any items yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userItems.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-square bg-gray-100">
                <img
                  src={item.productImage}
                  alt={item.productName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1">{item.productName}</h3>
                <p className="text-sm text-gray-600 mb-2">{item.type}</p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-blue-600">₹{item.price}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                    {item.isActive ? 'Available' : 'Sold'}
                  </span>
                </div>
                {item.isActive ? (
                  <button className="w-full mt-3 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
                    View Details
                  </button>
                ) : (
                  <button className="w-full mt-3 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed" disabled>
                    Sold
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>
{/* Followers Modal */}
{followersOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFollowersOpen(false)}>
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Followers</h3>
        <button className="text-gray-500 hover:text-gray-700" onClick={() => setFollowersOpen(false)} aria-label="Close">✕</button>
      </div>
      {followersLoading ? (
        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : followerUsers.length === 0 ? (
        <p className="text-gray-600">No followers yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {followerUsers.map(u => (
            <li key={u.id} className="py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {u.profilePhoto ? (
                  <img src={u.profilePhoto} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-gray-500">{u.name?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div className="flex-1">
                <Link to={`/user/${u.id}`} className="font-medium text-gray-900 hover:text-blue-600">{u.name || 'Unnamed User'}</Link>
                {u.college && <div className="text-xs text-gray-500">{u.college}</div>}
              </div>
              <Link to={`/user/${u.id}`} className="text-sm text-blue-600 hover:text-blue-700">View</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
)}
    </>
  );
};
