import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

const UserTypeCard = ({ icon, title, description, benefits, selected, onClick }) => {
  // Ensure selected is always a boolean
  const isSelected = Boolean(selected);
  
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected ? styles.cardSelected : styles.cardDefault
      ]}
      onPress={onClick}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconContainer}>
          <View style={[
            styles.iconBackground,
            isSelected ? styles.iconBackgroundSelected : styles.iconBackgroundDefault
          ]}>
            {icon}
          </View>
        </View>
        
        <View style={styles.textContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          
          <View style={styles.benefitsList}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Check size={16} color="#F37021" />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>
        
        {isSelected && (
          <View style={styles.checkmark}>
            <Check size={16} color="white" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  cardDefault: {
    backgroundColor: 'white',
    borderColor: '#e5e7eb',
  },
  cardSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#0C2D48',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 16,
  },
  iconBackground: {
    padding: 12,
    borderRadius: 8,
  },
  iconBackgroundDefault: {
    backgroundColor: '#dbeafe',
  },
  iconBackgroundSelected: {
    backgroundColor: '#0C2D48',
  },
  textContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
  },
  checkmark: {
    width: 24,
    height: 24,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default UserTypeCard;