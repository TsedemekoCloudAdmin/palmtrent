// components/CustomSelect.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const CustomSelect = ({ 
  options, 
  value, 
  onValueChange, 
  placeholder = "Select an option",
  style 
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (item) => {
    onValueChange(item.value);
    setModalVisible(false);
  };

  const selectedLabel = options.find(opt => opt.value === value)?.label || '';

  return (
    <View style={style}>
      <TouchableOpacity
        style={styles.selectInput}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={value ? styles.selectText : styles.selectPlaceholder}>
          {value ? selectedLabel : placeholder}
        </Text>
        <MaterialIcons 
          name={modalVisible ? "arrow-drop-up" : "arrow-drop-down"} 
          size={24} 
          color="#6b7280" 
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    value === item.value && styles.optionItemSelected
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[
                    styles.optionText,
                    value === item.value && styles.optionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {value === item.value && (
                    <MaterialIcons name="check" size={20} color="#0C2D48" />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  selectInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
  },
  optionTextSelected: {
    color: '#0C2D48',
    fontWeight: '500',
  },
});

export default CustomSelect;