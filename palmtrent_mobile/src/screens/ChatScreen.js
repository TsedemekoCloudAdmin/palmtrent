import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';

const ChatScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { bookingId, recipientId, recipientName, recipientType } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Load initial messages - simulated for now
    loadMessages();
  }, []);

  const loadMessages = async () => {
    // Simulate loading messages
    setTimeout(() => {
      setMessages([
        {
          id: '1',
          text: 'Hello! I\'m your assigned transporter for this delivery.',
          sender: 'other',
          timestamp: new Date(Date.now() - 3600000),
          senderName: recipientName || 'Driver'
        },
        {
          id: '2',
          text: 'Hi! Great, I\'ll have the cargo ready for pickup.',
          sender: 'me',
          timestamp: new Date(Date.now() - 3500000)
        },
        {
          id: '3',
          text: 'I\'m on my way to the pickup location. ETA 30 minutes.',
          sender: 'other',
          timestamp: new Date(Date.now() - 1800000),
          senderName: recipientName || 'Driver'
        }
      ]);
      setLoading(false);
    }, 500);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'me',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // In a real app, send message via socket/API
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender === 'me';
    const showDate = index === 0 ||
      formatDate(messages[index - 1].timestamp) !== formatDate(item.timestamp);

    return (
      <View>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDate(item.timestamp)}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, isMe ? styles.messageContainerMe : styles.messageContainerOther]}>
          {!isMe && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.senderName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
            {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.text}</Text>
            <Text style={[styles.timestamp, isMe && styles.timestampMe]}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {(recipientName || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{recipientName || 'Chat'}</Text>
            <Text style={styles.headerSubtitle}>
              {recipientType === 'transporter' ? 'Transporter' : 'Shipper'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.callButton}>
          <MaterialIcons name="phone" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Booking Reference */}
      {bookingId && (
        <View style={styles.bookingBanner}>
          <MaterialIcons name="local-shipping" size={16} color="#0C2D48" />
          <Text style={styles.bookingBannerText}>Booking: {bookingId}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0C2D48" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="chat-bubble-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Start the conversation by sending a message</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <MaterialIcons name="send" size={24} color={inputText.trim() ? 'white' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 45,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F37021',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  callButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  bookingBanner: {
    backgroundColor: '#dbeafe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 8,
  },
  bookingBannerText: {
    fontSize: 12,
    color: '#0C2D48',
    fontWeight: '500',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageContainerMe: {
    justifyContent: 'flex-end',
  },
  messageContainerOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F37021',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleMe: {
    backgroundColor: '#0C2D48',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F37021',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 20,
  },
  messageTextMe: {
    color: 'white',
  },
  timestamp: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timestampMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0C2D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
});

export default ChatScreen;
