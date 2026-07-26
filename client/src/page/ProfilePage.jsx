import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Copy,
    DoorOpen,
    ImagePlus,
    Home,
    Pencil,
    Plus,
    RefreshCw,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import BrandTitle from '../components/BrandTitle';
import { useAuthentication } from '../context/AuthenticationContext';
import { updateProfile } from '../api/profile';
import { getCurrentHouseholdId, setCurrentHouseholdId } from '../utils/currentHousehold';
import {
    createHousehold,
    getHouseholds,
    joinHousehold,
    leaveHousehold,
    regenerateHouseholdCode,
    renameHousehold,
} from '../api/household';

function getInitials(name = '') {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'BB';
    return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function memberLabel(member) {
    return member.display_name || member.email || 'Household member';
}

function readableError(err, fallback) {
    return err?.response?.data?.error?.message || fallback;
}

function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error('Choose a valid image file.'));
            image.onload = () => {
                const maxSize = 512;
                const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.86));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

export default function ProfilePage() {
    const { user, updateUser } = useAuthentication();
    const [households, setHouseholds] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [newHouseholdName, setNewHouseholdName] = useState('');
    const [inviteHousehold, setInviteHousehold] = useState(null);
    const [profileEditorOpen, setProfileEditorOpen] = useState(false);
    const [profileName, setProfileName] = useState(user?.display_name ?? '');
    const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profile_picture_url ?? '');
    const [profilePictureError, setProfilePictureError] = useState('');
    const [renameHouseholdTarget, setRenameHouseholdTarget] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [currentHouseholdId, setCurrentHouseholdIdState] = useState(() => getCurrentHouseholdId());
    const [copied, setCopied] = useState(false);

    const selectedHousehold = useMemo(
        () => households.find(household => household.id === selectedId) ?? households[0],
        [households, selectedId]
    );

    const showMessage = (text) => {
        setMessage(text);
        window.setTimeout(() => setMessage(''), 3000);
    };

    useEffect(() => {
        let ignore = false;

        getHouseholds()
            .then(res => {
                if (ignore) return;
                const nextHouseholds = res.data.households ?? [];
                const currentId = getCurrentHouseholdId();
                const currentStillExists = nextHouseholds.some(household => String(household.id) === String(currentId));
                const nextCurrentId = currentStillExists ? currentId : nextHouseholds[0]?.id;
                setHouseholds(nextHouseholds);
                setCurrentHouseholdId(nextCurrentId ?? null);
                setCurrentHouseholdIdState(nextCurrentId ? String(nextCurrentId) : null);
                setSelectedId(nextCurrentId ?? nextHouseholds[0]?.id ?? null);
            })
            .catch(err => {
                if (!ignore) setError(readableError(err, 'Failed to load your households.'));
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, []);

    const replaceHousehold = (updatedHousehold) => {
        setHouseholds(current => {
            const exists = current.some(household => household.id === updatedHousehold.id);
            if (!exists) return [...current, updatedHousehold];
            return current.map(household => household.id === updatedHousehold.id ? updatedHousehold : household);
        });
        setSelectedId(updatedHousehold.id);
    };

    const switchToHousehold = () => {
        if (!selectedHousehold) return;
        setCurrentHouseholdId(selectedHousehold.id);
        setCurrentHouseholdIdState(String(selectedHousehold.id));
        showMessage(`${selectedHousehold.name} is now your current household.`);
    };

    const openProfileEditor = () => {
        setProfileName(user?.display_name ?? '');
        setProfilePictureUrl(user?.profile_picture_url ?? '');
        setProfilePictureError('');
        setProfileEditorOpen(true);
    };

    const handleProfilePictureChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setProfilePictureError('Choose an image file.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setProfilePictureError('Choose an image smaller than 5 MB.');
            return;
        }

        try {
            const resizedImage = await resizeImage(file);
            setProfilePictureUrl(resizedImage);
            setProfilePictureError('');
        } catch (err) {
            setProfilePictureError(err.message);
        }
    };

    const handleProfileSave = async (event) => {
        event.preventDefault();
        if (!profileName.trim()) return;
        setBusy(true);
        setError('');
        try {
            const res = await updateProfile({
                display_name: profileName.trim(),
                profile_picture_url: profilePictureUrl.trim(),
            });
            updateUser(res.data.user);
            setHouseholds(current => current.map(household => ({
                ...household,
                members: household.members.map(member => (
                    member.id === res.data.user.id ? { ...member, ...res.data.user } : member
                )),
            })));
            setProfileEditorOpen(false);
            showMessage('Profile updated.');
        } catch (err) {
            setError(readableError(err, 'Could not update your profile.'));
        } finally {
            setBusy(false);
        }
    };

    const openRenameHousehold = () => {
        if (!selectedHousehold) return;
        setRenameValue(selectedHousehold.name);
        setRenameHouseholdTarget(selectedHousehold);
    };

    const handleJoin = async (event) => {
        event.preventDefault();
        if (!joinCode.trim()) return;
        setBusy(true);
        setError('');
        try {
            const res = await joinHousehold(joinCode.trim());
            replaceHousehold(res.data.household);
            setJoinCode('');
            showMessage(`Joined ${res.data.household.name}.`);
        } catch (err) {
            setError(readableError(err, 'That household code did not work.'));
        } finally {
            setBusy(false);
        }
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!newHouseholdName.trim()) return;
        setBusy(true);
        setError('');
        try {
            const res = await createHousehold(newHouseholdName.trim());
            replaceHousehold(res.data.household);
            setNewHouseholdName('');
            showMessage(`${res.data.household.name} created.`);
        } catch (err) {
            setError(readableError(err, 'Could not create the household.'));
        } finally {
            setBusy(false);
        }
    };

    const handleRename = async (event) => {
        event.preventDefault();
        if (!renameHouseholdTarget || !renameValue.trim()) return;
        setBusy(true);
        setError('');
        try {
            const res = await renameHousehold(renameHouseholdTarget.id, renameValue.trim());
            replaceHousehold(res.data.household);
            setRenameHouseholdTarget(null);
            showMessage('Household name updated.');
        } catch (err) {
            setError(readableError(err, 'Could not rename this household.'));
        } finally {
            setBusy(false);
        }
    };

    const handleLeave = async () => {
        if (!selectedHousehold || selectedHousehold.members.length <= 1) return;
        setBusy(true);
        setError('');
        try {
            await leaveHousehold(selectedHousehold.id);
            const nextHouseholds = households.filter(household => household.id !== selectedHousehold.id);
            const leftCurrentHousehold = String(selectedHousehold.id) === String(currentHouseholdId);
            if (leftCurrentHousehold) {
                const nextCurrentId = nextHouseholds[0]?.id ?? null;
                setCurrentHouseholdId(nextCurrentId);
                setCurrentHouseholdIdState(nextCurrentId ? String(nextCurrentId) : null);
            }
            setSelectedId(nextHouseholds[0]?.id ?? null);
            setHouseholds(nextHouseholds);
            showMessage(`Left ${selectedHousehold.name}.`);
        } catch (err) {
            setError(readableError(err, 'Could not leave this household.'));
        } finally {
            setBusy(false);
        }
    };

    const handleRegenerateCode = async () => {
        if (!inviteHousehold) return;
        setBusy(true);
        setError('');
        try {
            const res = await regenerateHouseholdCode(inviteHousehold.id);
            replaceHousehold(res.data.household);
            setInviteHousehold(res.data.household);
            setCopied(false);
            showMessage('Invite code refreshed.');
        } catch (err) {
            setError(readableError(err, 'Could not refresh the invite code.'));
        } finally {
            setBusy(false);
        }
    };

    const copyCode = async () => {
        if (!inviteHousehold?.code) return;
        try {
            await navigator.clipboard.writeText(inviteHousehold.code);
            setCopied(true);
        } catch {
            setError('Copy failed. Select the code and copy it manually.');
        }
    };

    const displayName = user?.display_name || 'ByteBite user';
    const canLeaveSelected = selectedHousehold && selectedHousehold.members.length > 1;
    const selectedIsCurrent = selectedHousehold && String(selectedHousehold.id) === String(currentHouseholdId);

    return (
        <main className="page-shell content-page recipe-page profile-page">
            <nav className="topbar">
                <BrandTitle />
                <Link className="illustrated-back-link" to="/dashboard">
                    <span aria-hidden="true">&lt;</span>
                    Dashboard
                </Link>
            </nav>

            <header className="profile-hero">
                <div className="profile-identity">
                    {user?.profile_picture_url ? (
                        <img src={user.profile_picture_url} alt="" className="profile-avatar" />
                    ) : (
                        <div className="profile-avatar profile-avatar-fallback" aria-hidden="true">
                            {getInitials(displayName)}
                        </div>
                    )}
                    <div>
                        <p className="eyebrow">Profile</p>
                        <h1>{displayName}</h1>
                        {user?.email && <p>{user.email}</p>}
                        <button className="button secondary profile-edit-button" type="button" onClick={openProfileEditor}>
                            <Pencil size={16} />
                            Edit profile
                        </button>
                    </div>
                </div>
            </header>

            {message && <p className="message success" role="status">{message}</p>}
            {error && <p className="message error" role="alert">{error}</p>}

            <section className="profile-layout">
                <section className="panel household-actions-panel" aria-labelledby="household-actions-title">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Household support</p>
                            <h2 id="household-actions-title">Manage access</h2>
                        </div>
                    </div>

                    <form className="household-mini-form" onSubmit={handleJoin}>
                        <label htmlFor="join-code">Join with code</label>
                        <div className="household-inline-control">
                            <input
                                id="join-code"
                                value={joinCode}
                                onChange={event => setJoinCode(event.target.value.toUpperCase())}
                                placeholder="AB12CD34EF"
                            />
                            <button className="button" type="submit" disabled={busy || !joinCode.trim()}>
                                <UserPlus size={17} />
                                Join
                            </button>
                        </div>
                    </form>

                    <form className="household-mini-form" onSubmit={handleCreate}>
                        <label htmlFor="household-name">Create household</label>
                        <div className="household-inline-control">
                            <input
                                id="household-name"
                                value={newHouseholdName}
                                onChange={event => setNewHouseholdName(event.target.value)}
                                placeholder="The He Family"
                            />
                            <button className="button secondary" type="submit" disabled={busy || !newHouseholdName.trim()}>
                                <Plus size={17} />
                                Create
                            </button>
                        </div>
                    </form>

                    <div className="household-list" aria-label="Your households">
                        {loading ? (
                            <p className="empty-state">Loading households...</p>
                        ) : households.length === 0 ? (
                            <p className="empty-state">No households yet. Create one or join with a code.</p>
                        ) : households.map(household => (
                            <button
                                key={household.id}
                                type="button"
                                className={`household-card ${selectedHousehold?.id === household.id ? 'is-selected' : ''}`}
                                onClick={() => setSelectedId(household.id)}
                            >
                                <span className="household-card-icon" aria-hidden="true"><Home size={22} /></span>
                                <span>
                                    <strong>
                                        {household.name}
                                        {String(household.id) === String(currentHouseholdId) && (
                                            <em className="current-household-badge">Current household</em>
                                        )}
                                    </strong>
                                    <small>{household.members.length} member{household.members.length === 1 ? '' : 's'}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="panel household-detail-panel" aria-labelledby="household-detail-title">
                    {selectedHousehold ? (
                        <>
                            <div className="section-heading household-detail-heading">
                                <div>
                                    <p className="eyebrow">Selected household</p>
                                    <h2 id="household-detail-title">
                                        {selectedHousehold.name}
                                        {selectedIsCurrent && <span className="current-household-title-badge">Current household</span>}
                                    </h2>
                                </div>
                                <div className="button-row">
                                    <button className="button secondary" type="button" onClick={openRenameHousehold}>
                                        <Pencil size={16} />
                                        Rename
                                    </button>
                                    <button className="button" type="button" onClick={() => setInviteHousehold(selectedHousehold)}>
                                        <UserPlus size={17} />
                                        Invite
                                    </button>
                                </div>
                            </div>

                            <div className="member-section">
                                <div className="member-section-title">
                                    <Users size={18} />
                                    <h3>Members</h3>
                                </div>
                                <ul className="member-list">
                                    {selectedHousehold.members.map(member => (
                                        <li key={member.id}>
                                            {member.profile_picture_url ? (
                                                <img src={member.profile_picture_url} alt="" className="member-avatar" />
                                            ) : (
                                                <span className="member-avatar member-avatar-fallback" aria-hidden="true">
                                                    {getInitials(memberLabel(member))}
                                                </span>
                                            )}
                                            <span>
                                                <strong>{memberLabel(member)}</strong>
                                                {member.email && <small>{member.email}</small>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {!selectedIsCurrent && (
                                <div className="household-switch-zone">
                                    <div>
                                        <strong>Use this household on dashboard</strong>
                                        <p>Switching changes which household inventory and reminders you see.</p>
                                    </div>
                                    <button className="button" type="button" onClick={switchToHousehold}>
                                        Switch to this household
                                    </button>
                                </div>
                            )}

                            <div className="household-danger-zone">
                                <div>
                                    <strong>Leave household</strong>
                                    <p>{canLeaveSelected ? 'You will lose access to this household and its fridges.' : 'The last member needs to keep the household active.'}</p>
                                </div>
                                <button className="button danger" type="button" disabled={busy || !canLeaveSelected} onClick={handleLeave}>
                                    <DoorOpen size={17} />
                                    Leave
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="empty-state">Choose a household to see members and invite details.</p>
                    )}
                </section>
            </section>

            {inviteHousehold && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setInviteHousehold(null)}>
                    <section className="modal panel invite-code-modal" role="dialog" aria-modal="true" aria-labelledby="invite-code-title" onMouseDown={event => event.stopPropagation()}>
                        <div className="section-heading">
                            <div>
                                <p className="eyebrow">Invite people</p>
                                <h2 id="invite-code-title">{inviteHousehold.name}</h2>
                            </div>
                            <button className="icon-button" type="button" aria-label="Close" onClick={() => setInviteHousehold(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <p className="invite-code-helper">Share this code with someone you want to add. They can join instantly from their profile page.</p>
                        <div className="invite-code-box">
                            <span>{inviteHousehold.code}</span>
                            <button className="button" type="button" onClick={copyCode}>
                                <Copy size={17} />
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>
                        <button className="text-button regenerate-code-button" type="button" disabled={busy} onClick={handleRegenerateCode}>
                            <RefreshCw size={15} />
                            Regenerate code
                        </button>
                    </section>
                </div>
            )}

            {profileEditorOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setProfileEditorOpen(false)}>
                    <section className="modal panel profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" onMouseDown={event => event.stopPropagation()}>
                        <form className="profile-edit-form" onSubmit={handleProfileSave}>
                            <div className="section-heading">
                                <div>
                                    <p className="eyebrow">Profile details</p>
                                    <h2 id="profile-edit-title">Edit profile</h2>
                                </div>
                                <button className="icon-button" type="button" aria-label="Close" onClick={() => setProfileEditorOpen(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <label htmlFor="profile-display-name">Display name</label>
                            <input
                                id="profile-display-name"
                                value={profileName}
                                onChange={event => setProfileName(event.target.value)}
                                autoFocus
                            />
                            <div className="profile-picture-upload">
                                {profilePictureUrl ? (
                                    <img src={profilePictureUrl} alt="" className="profile-picture-preview" />
                                ) : (
                                    <div className="profile-picture-preview profile-picture-preview-empty" aria-hidden="true">
                                        {getInitials(profileName)}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="profile-picture-file">Profile picture</label>
                                    <input
                                        id="profile-picture-file"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={handleProfilePictureChange}
                                    />
                                    <div className="button-row">
                                        <label className="button secondary profile-picture-picker" htmlFor="profile-picture-file">
                                            <ImagePlus size={16} />
                                            Choose image
                                        </label>
                                        {profilePictureUrl && (
                                            <button className="text-button" type="button" onClick={() => setProfilePictureUrl('')}>
                                                Remove photo
                                            </button>
                                        )}
                                    </div>
                                    {profilePictureError && <p className="helper-text profile-picture-error">{profilePictureError}</p>}
                                </div>
                            </div>
                            <div className="button-row">
                                <button className="button" type="submit" disabled={busy || !profileName.trim()}>Save</button>
                                <button className="button secondary" type="button" onClick={() => setProfileEditorOpen(false)}>Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {renameHouseholdTarget && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setRenameHouseholdTarget(null)}>
                    <section className="modal panel rename-household-modal" role="dialog" aria-modal="true" aria-labelledby="rename-household-title" onMouseDown={event => event.stopPropagation()}>
                        <form className="rename-household-form" onSubmit={handleRename}>
                            <div className="section-heading">
                                <div>
                                    <p className="eyebrow">Household name</p>
                                    <h2 id="rename-household-title">Rename household</h2>
                                </div>
                                <button className="icon-button" type="button" aria-label="Close" onClick={() => setRenameHouseholdTarget(null)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <label htmlFor="rename-household">New name</label>
                            <input
                                id="rename-household"
                                value={renameValue}
                                onChange={event => setRenameValue(event.target.value)}
                                autoFocus
                            />
                            <div className="button-row">
                                <button className="button" type="submit" disabled={busy || !renameValue.trim()}>Save</button>
                                <button className="button secondary" type="button" onClick={() => setRenameHouseholdTarget(null)}>Cancel</button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}
